# ml/lstm_model.py — RareSignal LSTM + Transformer ML architecture
"""
Full PyTorch implementation of the RareSignalModel.

Architecture:
  Input → Bidirectional LSTM → Transformer Encoder
       → Baseline Encoder
       → Trigger Attention Module
       → Volatility Feature Extractor
       → Disease Embedding
       → Signal Fusion Layer
       → [Risk Classifier | FIS Regressor | Forecast Head]

Loss:   0.5 * FocalLoss(risk) + 0.3 * HuberLoss(fis) + 0.2 * HuberLoss(forecast)

Calibration: Platt scaling (post-hoc)
Uncertainty: Monte Carlo Dropout (50 forward passes)
"""
import math
import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Dict, Optional, Tuple

# ─── Disease mapping ──────────────────────────────────────────────────────────
DISEASE_TO_IDX = {"ENS": 0, "EDS": 1, "POTS": 2, "Heterotaxy": 3, "PCD": 4, "FMF": 5, "CF": 6, "HD": 7, "RTT": 8, "MFS": 9, "SMA": 10, "FXS": 11, "NF1": 12, "PKU": 13, "WD": 14, "Pompe": 15, "TS": 16, "Gaucher": 17, "Alkaptonuria": 18, "Achondroplasia": 19, "RRP": 20, "PRION": 21}
RISK_TO_IDX = {"LOW": 0, "MODERATE": 1, "HIGH": 2, "CRITICAL": 3}
IDX_TO_RISK = {v: k for k, v in RISK_TO_IDX.items()}


# ─── Focal Loss ───────────────────────────────────────────────────────────────
class FocalLoss(nn.Module):
    """
    Focal Loss for handling class imbalance in risk classification.
    FL(p_t) = -alpha_t * (1 - p_t)^gamma * log(p_t)
    gamma=2.0 reduces relative loss of well-classified examples.
    """
    def __init__(self, alpha: Optional[torch.Tensor] = None, gamma: float = 2.0, reduction: str = "mean"):
        super().__init__()
        self.alpha = alpha
        self.gamma = gamma
        self.reduction = reduction

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        ce_loss = F.cross_entropy(logits, targets, weight=self.alpha, reduction="none")
        pt = torch.exp(-ce_loss)
        focal = (1 - pt) ** self.gamma * ce_loss
        if self.reduction == "mean":
            return focal.mean()
        elif self.reduction == "sum":
            return focal.sum()
        return focal


# ─── Positional Encoding ──────────────────────────────────────────────────────
class PositionalEncoding(nn.Module):
    def __init__(self, d_model: int, max_len: int = 200, dropout: float = 0.1):
        super().__init__()
        self.dropout = nn.Dropout(p=dropout)
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        self.register_buffer("pe", pe.unsqueeze(0))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x + self.pe[:, :x.size(1)]
        return self.dropout(x)


# ─── Main Model ───────────────────────────────────────────────────────────────
class RareSignalModel(nn.Module):
    """
    Multi-input, multi-task model for rare disease signal computation.

    Args:
        symptom_dim:  Number of symptom features per time step
        trigger_vocab: Number of unique trigger types
        n_diseases:   Number of supported diseases (5)
        hidden:       LSTM hidden size (bidirectional → hidden*2)
        lstm_layers:  Number of LSTM layers
        n_heads:      Transformer attention heads
        dropout:      Dropout rate
    """
    def __init__(
        self,
        symptom_dim: int = 10,
        trigger_vocab: int = 10,
        hpo_vocab: int = 50,
        n_diseases: int = 22,
        hidden: int = 64,
        lstm_layers: int = 2,
        n_heads: int = 4,
        dropout: float = 0.3
    ):
        super().__init__()
        self.symptom_dim = symptom_dim
        self.trigger_vocab = trigger_vocab
        self.hpo_vocab = hpo_vocab
        self.hidden = hidden

        # 1. Input projection
        self.input_proj = nn.Linear(symptom_dim, hidden)

        # 2. Bidirectional LSTM (temporal encoder)
        self.temporal_lstm = nn.LSTM(
            input_size=hidden,
            hidden_size=hidden,
            num_layers=lstm_layers,
            batch_first=True,
            dropout=dropout if lstm_layers > 1 else 0.0,
            bidirectional=True
        )

        # 3. Transformer encoder for long-range attention
        self.pos_enc = PositionalEncoding(hidden * 2, dropout=dropout * 0.5)
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=hidden * 2,
            nhead=n_heads,
            dim_feedforward=hidden * 4,
            dropout=dropout,
            batch_first=True,
            norm_first=True
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=2)

        # 4. Baseline encoder: [z_score, mu, sigma] → 32d
        self.baseline_encoder = nn.Sequential(
            nn.Linear(3, 32),
            nn.LayerNorm(32),
            nn.ReLU(),
            nn.Dropout(dropout * 0.5),
            nn.Linear(32, 32)
        )

        # 5. Trigger attention module
        self.trigger_embedding = nn.Embedding(trigger_vocab + 1, 32, padding_idx=0)
        self.trigger_query = nn.Linear(hidden * 2, 32)
        self.trigger_attn = nn.MultiheadAttention(embed_dim=32, num_heads=4, batch_first=True, dropout=dropout * 0.5)

        # 6. Volatility feature extractor: [rolling_std, cv, apen] → 16d
        self.volatility_encoder = nn.Sequential(
            nn.Linear(3, 16),
            nn.ReLU(),
            nn.Linear(16, 16)
        )

        # 7. Disease embedding
        self.disease_embedding = nn.Embedding(n_diseases, 16)

        # 7.5 Phenotype / HPO Multi-hot embedding projection
        self.hpo_projection = nn.Sequential(
            nn.Linear(hpo_vocab, 32),
            nn.ReLU(),
            nn.Dropout(dropout * 0.5)
        )

        # 8. Signal fusion layer
        fusion_in = hidden * 2 + 32 + 32 + 16 + 16 + 32
        self.fusion = nn.Sequential(
            nn.Linear(fusion_in, 256),
            nn.LayerNorm(256),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(256, 128),
            nn.LayerNorm(128),
            nn.ReLU(),
            nn.Dropout(dropout * 0.5)
        )

        # 9. Output heads
        self.risk_classifier = nn.Linear(128, 4)      # [LOW, MODERATE, HIGH, CRITICAL]
        self.fis_regressor = nn.Linear(128, 5)         # [mobility, cog, sleep, work, social]
        self.forecast_head = nn.Linear(128, 3)         # 3-day composite severity forecast

        self._init_weights()

    def _init_weights(self):
        for name, p in self.named_parameters():
            if "weight" in name and p.dim() >= 2:
                nn.init.xavier_uniform_(p)
            elif "bias" in name:
                nn.init.zeros_(p)

    def forward(
        self,
        x_seq: torch.Tensor,           # [B, T, symptom_dim]
        baseline_feats: torch.Tensor,  # [B, 3] — [z_score, mu, sigma] (representative)
        trigger_ids: torch.Tensor,     # [B, max_triggers] — padded trigger indices
        vol_feats: torch.Tensor,       # [B, 3] — [rolling_std, cv, apen]
        disease_ids: torch.Tensor,     # [B] — disease index
        hpo_multihot: torch.Tensor,    # [B, hpo_vocab] — encoded phenotypes
        src_key_padding_mask: Optional[torch.Tensor] = None  # [B, T] True = pad
    ) -> Dict[str, torch.Tensor]:

        B, T, D = x_seq.shape

        # ── Temporal encoding
        x_proj = F.relu(self.input_proj(x_seq))                  # [B, T, hidden]
        lstm_out, _ = self.temporal_lstm(x_proj)                  # [B, T, hidden*2]
        lstm_pe = self.pos_enc(lstm_out)
        transformer_out = self.transformer(
            lstm_pe, src_key_padding_mask=src_key_padding_mask
        )                                                          # [B, T, hidden*2]
        temporal_feat = transformer_out[:, -1, :]                 # [B, hidden*2] — last token

        # ── Baseline encoding
        base_feat = self.baseline_encoder(baseline_feats)         # [B, 32]

        # ── Trigger attention
        trig_emb = self.trigger_embedding(trigger_ids)             # [B, n_trig, 32]
        query = self.trigger_query(temporal_feat).unsqueeze(1)     # [B, 1, 32]
        trig_feat, trigger_attn_weights = self.trigger_attn(
            query, trig_emb, trig_emb
        )                                                          # [B, 1, 32]
        trig_feat = trig_feat.squeeze(1)                           # [B, 32]

        # ── Volatility features
        vol_feat = self.volatility_encoder(vol_feats)              # [B, 16]

        # ── Disease embedding
        disease_feat = self.disease_embedding(disease_ids)         # [B, 16]

        # ── HPO / Phenotype projection
        hpo_feat = self.hpo_projection(hpo_multihot)               # [B, 32]

        # ── Fusion
        fused = torch.cat([
            temporal_feat, base_feat, trig_feat, vol_feat, disease_feat, hpo_feat
        ], dim=-1)                                                  # [B, fusion_in]
        hidden = self.fusion(fused)                                 # [B, 128]

        return {
            "risk_logits": self.risk_classifier(hidden),           # [B, 4]
            "fis_scores": torch.sigmoid(self.fis_regressor(hidden)),  # [B, 5]
            "forecast": self.forecast_head(hidden),                # [B, 3]
            "trigger_attention": trigger_attn_weights              # [B, 1, n_trig]
        }

    @torch.no_grad()
    def predict_with_uncertainty(
        self,
        x_seq: torch.Tensor,
        baseline_feats: torch.Tensor,
        trigger_ids: torch.Tensor,
        vol_feats: torch.Tensor,
        disease_ids: torch.Tensor,
        hpo_multihot: torch.Tensor,
        n_samples: int = 50
    ) -> Dict:
        """
        Monte Carlo Dropout for uncertainty estimation.
        Runs n_samples forward passes with dropout ACTIVE.
        Returns mean predictions + standard deviation as uncertainty.
        """
        self.train()  # Enable dropout for MC sampling
        risk_samples = []
        fis_samples = []
        forecast_samples = []

        for _ in range(n_samples):
            out = self(x_seq, baseline_feats, trigger_ids, vol_feats, disease_ids, hpo_multihot)
            risk_samples.append(torch.softmax(out["risk_logits"], dim=-1))
            fis_samples.append(out["fis_scores"])
            forecast_samples.append(out["forecast"])

        self.eval()

        risk_stack = torch.stack(risk_samples, dim=0)       # [n_samples, B, 4]
        fis_stack = torch.stack(fis_samples, dim=0)         # [n_samples, B, 5]
        forecast_stack = torch.stack(forecast_samples, dim=0)  # [n_samples, B, 3]

        return {
            "risk_mean": risk_stack.mean(0),
            "risk_std": risk_stack.std(0),
            "fis_mean": fis_stack.mean(0),
            "fis_std": fis_stack.std(0),
            "forecast_mean": forecast_stack.mean(0),
            "forecast_std": forecast_stack.std(0),
        }


# ─── Platt Calibration ────────────────────────────────────────────────────────
class PlattCalibrator(nn.Module):
    """
    Post-hoc probability calibration using learned temperature scaling.
    Apply AFTER training on a held-out calibration set.
    """
    def __init__(self, n_classes: int = 4):
        super().__init__()
        self.temperature = nn.Parameter(torch.ones(1) * 1.5)

    def forward(self, logits: torch.Tensor) -> torch.Tensor:
        return F.softmax(logits / self.temperature.clamp(min=0.1), dim=-1)

    def calibrate(self, logits: torch.Tensor, labels: torch.Tensor, lr: float = 0.01, n_steps: int = 100):
        """Fit temperature on calibration set."""
        optimizer = torch.optim.LBFGS([self.temperature], lr=lr, max_iter=n_steps)
        def closure():
            optimizer.zero_grad()
            loss = F.cross_entropy(logits / self.temperature.clamp(min=0.1), labels)
            loss.backward()
            return loss
        optimizer.step(closure)
        return self


# ─── Model factory ────────────────────────────────────────────────────────────
def build_model(disease: str = "POTS") -> RareSignalModel:
    from backend.disease_config import DISEASE_CONFIGS
    config = DISEASE_CONFIGS[disease]
    n_symptoms = len(config["symptoms"])
    n_triggers = len(config["triggers"])
    return RareSignalModel(
        symptom_dim=n_symptoms,
        trigger_vocab=n_triggers,
        hpo_vocab=50,
        n_diseases=22,
        hidden=64,
        lstm_layers=2,
        n_heads=4,
        dropout=0.3
    )
