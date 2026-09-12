import os
import uuid
import json
from datetime import datetime
from decimal import Decimal
from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.types import TypeDecorator, TEXT
from sqlalchemy.sql import func

load_dotenv()

app = Flask(__name__)
CORS(app)

# ==============================================================================
# DATABASE CONFIGURATION (Auto-swaps SQLite <-> PostgreSQL / Supabase)
# ==============================================================================
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL and DATABASE_URL.strip() and "localhost" not in DATABASE_URL:
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL
    IS_POSTGRES = True
    print(f">>> Connected to Remote Database: {DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else 'PostgreSQL'}")
else:
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///warehouse.db"
    IS_POSTGRES = False
    print(">>> No remote DB URL found. Running smoothly on local SQLite: warehouse.db")

app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)


# ==============================================================================
# CROSS-DATABASE COMPATIBLE TYPES (Supports both PostgreSQL & SQLite)
# ==============================================================================
class JSONBCompat(TypeDecorator):
    impl = TEXT
    def process_bind_param(self, value, dialect):
        return json.dumps(value) if value is not None else "{}"
    def process_result_value(self, value, dialect):
        return json.loads(value) if value is not None else {}

class ArrayCompat(TypeDecorator):
    impl = TEXT
    def process_bind_param(self, value, dialect):
        return json.dumps(value) if value is not None else "[]"
    def process_result_value(self, value, dialect):
        return json.loads(value) if value is not None else []


# ==============================================================================
# DATABASE MODELS (Exact match to DB Lead's Schema)
# ==============================================================================
class Zone(db.Model):
    __tablename__ = "zones"
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.Text, nullable=False)
    pin_prefix_rules = db.Column(ArrayCompat, nullable=False, default=list)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "pin_prefix_rules": self.pin_prefix_rules
        }

class Van(db.Model):
    __tablename__ = "vans"
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    plate_no = db.Column(db.Text, unique=True, nullable=False)
    zone_id = db.Column(db.String(36), db.ForeignKey("zones.id"), nullable=False)
    capacity_kg = db.Column(db.Numeric(10, 2), nullable=False)
    current_load_kg = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    status = db.Column(db.Text, nullable=False, default="AVAILABLE")  # AVAILABLE, LOADING, DISPATCHED

    zone = db.relationship("Zone", backref="vans", lazy=True)
    parcels = db.relationship("Parcel", backref="van", lazy=True)

    def to_dict(self):
        cap = float(self.capacity_kg)
        curr = float(self.current_load_kg)
        return {
            "id": self.id,
            "plate_no": self.plate_no,
            "zone_id": self.zone_id,
            "zone_name": self.zone.name if self.zone else "Unknown",
            "capacity_kg": cap,
            "current_load_kg": curr,
            "remaining_capacity_kg": round(max(0.0, cap - curr), 2),
            "status": self.status,
            "loaded_parcel_count": len([p for p in self.parcels if p.status == "LOADED"])
        }

class Parcel(db.Model):
    __tablename__ = "parcels"
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tracking_code = db.Column(db.Text, unique=True, nullable=False)
    pin_code = db.Column(db.Text, nullable=False)
    weight_kg = db.Column(db.Numeric(10, 2), nullable=False)
    zone_id = db.Column(db.String(36), db.ForeignKey("zones.id"), nullable=False)
    status = db.Column(db.Text, nullable=False, default="UNASSIGNED")  # UNASSIGNED, LOADED, IN_TRANSIT, DELIVERED
    van_id = db.Column(db.String(36), db.ForeignKey("vans.id"), nullable=True)
    created_by = db.Column(db.String(36), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    zone = db.relationship("Zone", backref="parcels", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "tracking_code": self.tracking_code,
            "pin_code": self.pin_code,
            "weight_kg": float(self.weight_kg),
            "zone_id": self.zone_id,
            "zone_name": self.zone.name if self.zone else "Unknown",
            "status": self.status,
            "van_id": self.van_id,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class Manifest(db.Model):
    __tablename__ = "manifests"
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    van_id = db.Column(db.String(36), db.ForeignKey("vans.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    dispatched_at = db.Column(db.DateTime, nullable=True)
    dispatched_by = db.Column(db.String(36), nullable=True)

    items = db.relationship("ManifestItem", backref="manifest", lazy=True, cascade="all, delete-orphan")

class ManifestItem(db.Model):
    __tablename__ = "manifest_items"
    manifest_id = db.Column(db.String(36), db.ForeignKey("manifests.id", ondelete="CASCADE"), primary_key=True)
    parcel_id = db.Column(db.String(36), db.ForeignKey("parcels.id"), primary_key=True, unique=True)

class AuditLog(db.Model):
    __tablename__ = "audit_log"
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    actor_id = db.Column(db.String(36), nullable=True)
    action = db.Column(db.Text, nullable=False)  # 'SCAN', 'LOAD', 'DISPATCH'
    parcel_id = db.Column(db.String(36), db.ForeignKey("parcels.id"), nullable=True)
    van_id = db.Column(db.String(36), db.ForeignKey("vans.id"), nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    metadata_ = db.Column("metadata", JSONBCompat, nullable=False, default=dict)

    def to_dict(self):
        return {
            "id": self.id,
            "actor_id": self.actor_id,
            "action": self.action,
            "parcel_id": self.parcel_id,
            "van_id": self.van_id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "metadata": self.metadata_
        }


# ==============================================================================
# DYNAMIC PIN -> ZONE ROUTING HELPER
# ==============================================================================
def resolve_zone_by_pin(pin_code: str):
    clean_pin = str(pin_code).strip()
    all_zones = Zone.query.all()
    for z in all_zones:
        if z.pin_prefix_rules:
            for prefix in z.pin_prefix_rules:
                if clean_pin.startswith(prefix):
                    return z
    return all_zones[0] if all_zones else None


# ==============================================================================
# API 1: POST /api/parcels/inbound (Register Inbound Parcel)
# ==============================================================================
@app.route("/api/parcels/inbound", methods=["POST"])
def register_inbound():
    data = request.get_json() or {}
    tracking_code = data.get("tracking_code")
    pin_code = data.get("pin_code")
    weight_kg = data.get("weight") or data.get("weight_kg")
    actor_id = data.get("actor_id")

    if not tracking_code or not pin_code or weight_kg is None:
        return jsonify({"error": "tracking_code, pin_code, and weight_kg are required"}), 400

    try:
        weight_val = Decimal(str(weight_kg))
        if weight_val <= 0:
            return jsonify({"error": "weight_kg must be greater than 0"}), 400
    except Exception:
        return jsonify({"error": "Invalid weight_kg format"}), 400

    if Parcel.query.filter_by(tracking_code=tracking_code).first():
        return jsonify({"error": f"Parcel with tracking_code '{tracking_code}' already exists"}), 409

    matched_zone = resolve_zone_by_pin(pin_code)
    if not matched_zone:
        return jsonify({"error": "No delivery zone configured for this PIN code"}), 400

    parcel = Parcel(
        tracking_code=tracking_code,
        pin_code=str(pin_code),
        weight_kg=weight_val,
        zone_id=matched_zone.id,
        status="UNASSIGNED",
        created_by=str(actor_id) if actor_id else None
    )
    db.session.add(parcel)
    db.session.flush()

    # Immutable Audit Log
    log = AuditLog(
        actor_id=str(actor_id) if actor_id else None,
        action="SCAN",
        parcel_id=parcel.id,
        van_id=None,
        metadata_={
            "tracking_code": tracking_code,
            "pin_code": str(pin_code),
            "weight_kg": float(weight_val),
            "zone_name": matched_zone.name
        }
    )
    db.session.add(log)
    db.session.commit()

    return jsonify({
        "message": "Parcel scanned and registered successfully",
        "parcel": parcel.to_dict()
    }), 201


# ==============================================================================
# API 2: GET /api/parcels/unassigned (Unassigned Parcels List)
# ==============================================================================
@app.route("/api/parcels/unassigned", methods=["GET"])
def get_unassigned():
    zone_id = request.args.get("zone_id")
    zone_name = request.args.get("zone")

    query = Parcel.query.filter_by(status="UNASSIGNED")

    if zone_id:
        query = query.filter_by(zone_id=zone_id)
    elif zone_name:
        matched = Zone.query.filter(Zone.name.ilike(f"%{zone_name}%")).first()
        if matched:
            query = query.filter_by(zone_id=matched.id)

    parcels = query.order_by(Parcel.created_at.desc()).all()
    return jsonify([p.to_dict() for p in parcels]), 200


# ==============================================================================
# API 3: POST /api/vans/<van_id>/load-parcel (Load Parcel with Validations)
# ==============================================================================
@app.route("/api/vans/<van_id>/load-parcel", methods=["POST"])
def load_parcel(van_id):
    data = request.get_json() or {}
    parcel_id = data.get("parcel_id")
    actor_id = data.get("actor_id")

    if not parcel_id:
        return jsonify({"error": "parcel_id is required"}), 400

    van = Van.query.get(str(van_id))
    if not van:
        return jsonify({"error": f"Van '{van_id}' not found"}), 404

    if van.status == "DISPATCHED":
        return jsonify({"error": "Cannot load onto a DISPATCHED vehicle"}), 400

    parcel = Parcel.query.get(str(parcel_id))
    if not parcel:
        return jsonify({"error": f"Parcel '{parcel_id}' not found"}), 404

    if parcel.status != "UNASSIGNED":
        return jsonify({"error": f"Parcel status is '{parcel.status}', must be 'UNASSIGNED'"}), 400

    # CONSTRAINT 1: Zone Matching
    if parcel.zone_id != van.zone_id:
        parcel_zone = parcel.zone.name if parcel.zone else "Unknown"
        van_zone = van.zone.name if van.zone else "Unknown"
        return jsonify({
            "error": f"Zone mismatch: Parcel is bound for '{parcel_zone}', but Van is assigned to '{van_zone}'."
        }), 400

    # CONSTRAINT 2: Hard Payload Weight Capacity (HTTP 400 Bad Request)
    new_load = Decimal(str(van.current_load_kg)) + Decimal(str(parcel.weight_kg))
    if new_load > Decimal(str(van.capacity_kg)):
        remaining = Decimal(str(van.capacity_kg)) - Decimal(str(van.current_load_kg))
        return jsonify({
            "error": "Vehicle payload exceeded",
            "detail": f"Adding {parcel.weight_kg} kg exceeds remaining capacity of {remaining:.2f} kg. Max capacity: {van.capacity_kg} kg."
        }), 400

    # Update parcel and van
    parcel.van_id = van.id
    parcel.status = "LOADED"
    van.current_load_kg = new_load
    if van.status == "AVAILABLE":
        van.status = "LOADING"

    # Append to Audit Log
    log = AuditLog(
        actor_id=str(actor_id) if actor_id else None,
        action="LOAD",
        parcel_id=parcel.id,
        van_id=van.id,
        metadata_={
            "plate_no": van.plate_no,
            "parcel_weight_kg": float(parcel.weight_kg),
            "new_total_load_kg": float(new_load),
            "capacity_kg": float(van.capacity_kg)
        }
    )
    db.session.add(log)
    db.session.commit()

    return jsonify({
        "message": "Parcel loaded successfully",
        "van": van.to_dict()
    }), 200


# ==============================================================================
# API 4: POST /api/vans/<van_id>/dispatch (Atomic Batch State Progression)
# ==============================================================================
@app.route("/api/vans/<van_id>/dispatch", methods=["POST"])
def dispatch_van(van_id):
    data = request.get_json() or {}
    actor_id = data.get("actor_id")

    van = Van.query.get(str(van_id))
    if not van:
        return jsonify({"error": f"Van '{van_id}' not found"}), 404

    if van.status == "DISPATCHED":
        return jsonify({"error": "Vehicle is already DISPATCHED"}), 400

    loaded_parcels = Parcel.query.filter_by(van_id=van.id, status="LOADED").all()
    if not loaded_parcels:
        return jsonify({"error": "Cannot dispatch an empty van. Please load parcels first."}), 400

    # ATOMIC DATABASE TRANSACTION
    try:
        now = datetime.utcnow()
        van.status = "DISPATCHED"

        # Create Trip Manifest
        manifest = Manifest(
            van_id=van.id,
            created_at=now,
            dispatched_at=now,
            dispatched_by=str(actor_id) if actor_id else None
        )
        db.session.add(manifest)
        db.session.flush()

        # Transition parcels & create ManifestItems
        for p in loaded_parcels:
            p.status = "IN_TRANSIT"
            item = ManifestItem(manifest_id=manifest.id, parcel_id=p.id)
            db.session.add(item)

            log = AuditLog(
                actor_id=str(actor_id) if actor_id else None,
                action="DISPATCH",
                parcel_id=p.id,
                van_id=van.id,
                metadata_={
                    "manifest_id": manifest.id,
                    "plate_no": van.plate_no,
                    "tracking_code": p.tracking_code,
                    "weight_kg": float(p.weight_kg)
                }
            )
            db.session.add(log)

        db.session.commit()  # All changes committed atomically
    except Exception as e:
        db.session.rollback()  # Full rollback on failure
        return jsonify({"error": "Dispatch transaction failed", "details": str(e)}), 500

    return jsonify({
        "message": f"Van {van.plate_no} successfully dispatched. All packages Out for Delivery.",
        "manifest_id": manifest.id,
        "van_id": van.id,
        "dispatched_count": len(loaded_parcels),
        "dispatched_at": now.isoformat()
    }), 200


# ==============================================================================
# HELPER APIS (For Frontend Loading Bay UI)
# ==============================================================================
@app.route("/api/zones", methods=["GET"])
def get_zones():
    zones = Zone.query.all()
    return jsonify([z.to_dict() for z in zones]), 200

@app.route("/api/vans", methods=["GET"])
def get_vans():
    vans = Van.query.all()
    return jsonify([v.to_dict() for v in vans]), 200

@app.route("/api/vans/<van_id>/parcels", methods=["GET"])
def get_van_parcels(van_id):
    parcels = Parcel.query.filter_by(van_id=str(van_id)).all()
    return jsonify([p.to_dict() for p in parcels]), 200

@app.route("/api/audit-logs", methods=["GET"])
def get_audit_logs():
    logs = AuditLog.query.order_by(AuditLog.timestamp.desc()).limit(50).all()
    return jsonify([l.to_dict() for l in logs]), 200


# ==============================================================================
# INITIAL SEEDER (Runs automatically so test data is ready)
# ==============================================================================
def init_db():
    with app.app_context():
        db.create_all()
        if not Zone.query.first():
            north = Zone(name="North Zone", pin_prefix_rules=["110", "111", "680"])
            south = Zone(name="South Zone", pin_prefix_rules=["560", "600"])
            west = Zone(name="West Zone", pin_prefix_rules=["400", "411"])
            db.session.add_all([north, south, west])
            db.session.commit()

            van1 = Van(plate_no="DL-01-AB-1234", zone_id=north.id, capacity_kg=100.00, status="AVAILABLE")
            van2 = Van(plate_no="KA-05-CD-5678", zone_id=south.id, capacity_kg=80.00, status="AVAILABLE")
            db.session.add_all([van1, van2])
            db.session.commit()
            print(">>> Default Zones & Vans seeded successfully!")

if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=True)