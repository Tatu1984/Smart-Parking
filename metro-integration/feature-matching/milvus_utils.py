"""
MilvusDB Utilities for Vehicle Feature Matching

Handles vector database operations for vehicle image search.
"""

import logging
import os
from typing import Optional

from pymilvus import (
    Collection,
    CollectionSchema,
    DataType,
    FieldSchema,
    MilvusClient,
    connections,
    utility,
)

logger = logging.getLogger(__name__)

# Configuration
MILVUS_ENDPOINT = os.getenv("MILVUS_ENDPOINT", "http://milvus-db:19530")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "sparking_vehicles")
FEATURE_DIM = int(os.getenv("FEATURE_MODEL_DIM", "1000"))

# Index parameters for HNSW (optimal for production)
INDEX_PARAMS = {
    "metric_type": "COSINE",
    "index_type": "HNSW",
    "params": {"M": 16, "efConstruction": 256},
}

# Search parameters
SEARCH_PARAMS = {"metric_type": "COSINE", "params": {"ef": 128}}


class MilvusVehicleIndex:
    """Manages vehicle feature vectors in MilvusDB."""

    def __init__(self):
        self.client: Optional[MilvusClient] = None
        self.collection: Optional[Collection] = None

    def connect(self) -> bool:
        """Connect to MilvusDB."""
        try:
            # Extract host and port from endpoint (handle IPv6 and edge cases)
            endpoint = MILVUS_ENDPOINT.replace("http://", "").replace("https://", "")
            # Use rsplit to handle potential edge cases with multiple colons
            parts = endpoint.rsplit(":", 1)
            if len(parts) != 2:
                raise ValueError(f"Invalid endpoint format: {MILVUS_ENDPOINT}")
            host, port = parts

            connections.connect(alias="default", host=host, port=int(port))

            # Initialize client for simpler operations
            self.client = MilvusClient(uri=MILVUS_ENDPOINT)

            logger.info(f"Connected to MilvusDB at {MILVUS_ENDPOINT}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to MilvusDB: {e}")
            return False

    def ensure_collection(self) -> bool:
        """Ensure the collection exists with proper schema."""
        try:
            if utility.has_collection(COLLECTION_NAME):
                self.collection = Collection(COLLECTION_NAME)
                self.collection.load()
                logger.info(f"Loaded existing collection: {COLLECTION_NAME}")
                return True

            # Create schema
            fields = [
                FieldSchema(
                    name="id",
                    dtype=DataType.VARCHAR,
                    max_length=64,
                    is_primary=True,
                ),
                FieldSchema(
                    name="feature_vector",
                    dtype=DataType.FLOAT_VECTOR,
                    dim=FEATURE_DIM,
                ),
                FieldSchema(
                    name="camera_id",
                    dtype=DataType.VARCHAR,
                    max_length=64,
                ),
                FieldSchema(
                    name="vehicle_type",
                    dtype=DataType.VARCHAR,
                    max_length=32,
                ),
                FieldSchema(
                    name="vehicle_color",
                    dtype=DataType.VARCHAR,
                    max_length=32,
                ),
                FieldSchema(
                    name="license_plate",
                    dtype=DataType.VARCHAR,
                    max_length=20,
                ),
                FieldSchema(
                    name="detected_at",
                    dtype=DataType.INT64,  # Unix timestamp
                ),
                FieldSchema(
                    name="confidence",
                    dtype=DataType.FLOAT,
                ),
                FieldSchema(
                    name="image_url",
                    dtype=DataType.VARCHAR,
                    max_length=512,
                ),
            ]

            schema = CollectionSchema(
                fields=fields,
                description="Vehicle feature vectors for image search",
            )

            self.collection = Collection(
                name=COLLECTION_NAME,
                schema=schema,
            )

            # Create index on feature vector
            self.collection.create_index(
                field_name="feature_vector",
                index_params=INDEX_PARAMS,
            )

            # Create index on camera_id for filtering
            self.collection.create_index(
                field_name="camera_id",
                index_params={"index_type": "INVERTED"},
            )

            self.collection.load()
            logger.info(f"Created and loaded collection: {COLLECTION_NAME}")
            return True

        except Exception as e:
            logger.error(f"Failed to ensure collection: {e}")
            return False

    def insert_feature(
        self,
        feature_id: str,
        feature_vector: list[float],
        camera_id: str,
        detected_at: int,
        confidence: float,
        image_url: str,
        vehicle_type: str = "",
        vehicle_color: str = "",
        license_plate: str = "",
    ) -> bool:
        """Insert a vehicle feature vector."""
        try:
            if not self.collection:
                if not self.ensure_collection():
                    return False

            data = [
                {
                    "id": feature_id,
                    "feature_vector": feature_vector,
                    "camera_id": camera_id,
                    "vehicle_type": vehicle_type or "",
                    "vehicle_color": vehicle_color or "",
                    "license_plate": license_plate or "",
                    "detected_at": detected_at,
                    "confidence": confidence,
                    "image_url": image_url,
                }
            ]

            self.collection.insert(data)
            logger.debug(f"Inserted feature: {feature_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to insert feature: {e}")
            return False

    def search_similar(
        self,
        query_vector: list[float],
        limit: int = 10,
        camera_ids: Optional[list[str]] = None,
        min_confidence: float = 0.0,
    ) -> list[dict]:
        """Search for similar vehicle features."""
        try:
            if not self.collection:
                if not self.ensure_collection():
                    return []

            # Build filter expression
            filter_expr = ""
            if camera_ids:
                # Sanitize camera IDs to prevent injection (escape quotes)
                sanitized_ids = [cid.replace('"', '\\"').replace("'", "\\'") for cid in camera_ids]
                camera_filter = " || ".join(
                    [f'camera_id == "{cid}"' for cid in sanitized_ids]
                )
                filter_expr = f"({camera_filter})"
            if min_confidence > 0:
                conf_filter = f"confidence >= {min_confidence}"
                filter_expr = (
                    f"{filter_expr} && {conf_filter}" if filter_expr else conf_filter
                )

            results = self.collection.search(
                data=[query_vector],
                anns_field="feature_vector",
                param=SEARCH_PARAMS,
                limit=limit,
                expr=filter_expr if filter_expr else None,
                output_fields=[
                    "id",
                    "camera_id",
                    "vehicle_type",
                    "vehicle_color",
                    "license_plate",
                    "detected_at",
                    "confidence",
                    "image_url",
                ],
            )

            matches = []
            for hits in results:
                for hit in hits:
                    matches.append(
                        {
                            "id": hit.entity.get("id"),
                            "score": hit.score,  # Cosine similarity
                            "camera_id": hit.entity.get("camera_id"),
                            "vehicle_type": hit.entity.get("vehicle_type"),
                            "vehicle_color": hit.entity.get("vehicle_color"),
                            "license_plate": hit.entity.get("license_plate"),
                            "detected_at": hit.entity.get("detected_at"),
                            "confidence": hit.entity.get("confidence"),
                            "image_url": hit.entity.get("image_url"),
                        }
                    )

            return matches

        except Exception as e:
            logger.error(f"Search failed: {e}")
            return []

    def delete_feature(self, feature_id: str) -> bool:
        """Delete a feature by ID."""
        try:
            if not self.collection:
                return False

            self.collection.delete(expr=f'id == "{feature_id}"')
            logger.debug(f"Deleted feature: {feature_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to delete feature: {e}")
            return False

    def get_stats(self) -> dict:
        """Get collection statistics."""
        try:
            if not self.collection:
                return {}

            self.collection.flush()
            return {
                "collection_name": COLLECTION_NAME,
                "num_entities": self.collection.num_entities,
                "feature_dim": FEATURE_DIM,
            }

        except Exception as e:
            logger.error(f"Failed to get stats: {e}")
            return {}

    def close(self):
        """Close connection."""
        try:
            if self.collection:
                self.collection.release()
            connections.disconnect("default")
            logger.info("Disconnected from MilvusDB")
        except Exception as e:
            logger.warning(f"Error during disconnect: {e}")


# Singleton instance
_milvus_index: Optional[MilvusVehicleIndex] = None


def get_milvus_index() -> MilvusVehicleIndex:
    """Get or create MilvusDB index instance."""
    global _milvus_index
    if _milvus_index is None:
        _milvus_index = MilvusVehicleIndex()
        _milvus_index.connect()
        _milvus_index.ensure_collection()
    return _milvus_index
