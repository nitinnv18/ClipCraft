import os
import shutil
import asyncio
from typing import Dict, Any
import cloudinary
from app.core.config import settings
from app.core.logging import logger
from app.providers.base import BaseStorageProvider

class CloudinaryStorageProvider(BaseStorageProvider):
    def __init__(self):
        self.is_configured = False
        if (
            settings.STORAGE_MODE == "cloud"
            and settings.CLOUDINARY_CLOUD_NAME
            and settings.CLOUDINARY_API_KEY
            and settings.CLOUDINARY_API_SECRET
        ):
            cloudinary.config(
                cloud_name=settings.CLOUDINARY_CLOUD_NAME,
                api_key=settings.CLOUDINARY_API_KEY,
                api_secret=settings.CLOUDINARY_API_SECRET,
                secure=True
            )
            self.is_configured = True
            logger.info("Cloudinary storage provider initialized with configured credentials.")
        else:
            logger.info("Storage set to LOCAL mode. Clips and thumbnails will be saved locally (0 CDN bandwidth/quota).")
            os.makedirs(os.path.join(settings.TEMP_STORAGE_DIR, "public_media", "clips"), exist_ok=True)
            os.makedirs(os.path.join(settings.TEMP_STORAGE_DIR, "public_media", "thumbnails"), exist_ok=True)

    async def upload_video(self, local_file_path: str, public_id_prefix: str = "clips", force_local: bool = False) -> Dict[str, Any]:
        if not os.path.exists(local_file_path):
            raise FileNotFoundError(f"Local video file not found: {local_file_path}")

        file_name = os.path.basename(local_file_path)
        base_id = os.path.splitext(file_name)[0]
        public_id = f"ai-video-clipper/{public_id_prefix}/{base_id}"

        if self.is_configured and not force_local:
            try:
                import cloudinary.uploader
                logger.info(f"Uploading video {local_file_path} to Cloudinary as {public_id}...")
                result = await asyncio.to_thread(
                    cloudinary.uploader.upload_large,
                    local_file_path,
                    resource_type="video",
                    public_id=public_id,
                    overwrite=True,
                    chunk_size=6000000
                )
                return {
                    "public_id": result.get("public_id"),
                    "secure_url": result.get("secure_url"),
                    "duration": result.get("duration"),
                    "format": result.get("format"),
                    "bytes": result.get("bytes")
                }
            except Exception as e:
                logger.error(f"Cloudinary video upload failed: {e}. Falling back to local serving.")

        # Local static serving fallback
        public_dir = os.path.join(settings.TEMP_STORAGE_DIR, "public_media", public_id_prefix)
        os.makedirs(public_dir, exist_ok=True)
        dest_path = os.path.join(public_dir, file_name)
        await asyncio.to_thread(shutil.copyfile, local_file_path, dest_path)
        
        url = f"/api/media/{public_id_prefix}/{file_name}"
        return {
            "public_id": public_id,
            "secure_url": url,
            "duration": None,
            "format": "mp4",
            "bytes": os.path.getsize(dest_path)
        }

    async def upload_image(self, local_file_path: str, public_id_prefix: str = "thumbnails", force_local: bool = False) -> Dict[str, Any]:
        if not os.path.exists(local_file_path):
            raise FileNotFoundError(f"Local image file not found: {local_file_path}")

        file_name = os.path.basename(local_file_path)
        base_id = os.path.splitext(file_name)[0]
        public_id = f"ai-video-clipper/{public_id_prefix}/{base_id}"

        if self.is_configured and not force_local:
            try:
                import cloudinary.uploader
                logger.info(f"Uploading thumbnail {local_file_path} to Cloudinary as {public_id}...")
                result = await asyncio.to_thread(
                    cloudinary.uploader.upload,
                    local_file_path,
                    resource_type="image",
                    public_id=public_id,
                    overwrite=True
                )
                return {
                    "public_id": result.get("public_id"),
                    "secure_url": result.get("secure_url")
                }
            except Exception as e:
                logger.error(f"Cloudinary image upload failed: {e}. Falling back to local serving.")

        # Local fallback
        public_dir = os.path.join(settings.TEMP_STORAGE_DIR, "public_media", public_id_prefix)
        os.makedirs(public_dir, exist_ok=True)
        dest_path = os.path.join(public_dir, file_name)
        await asyncio.to_thread(shutil.copyfile, local_file_path, dest_path)

        url = f"/api/media/{public_id_prefix}/{file_name}"
        return {
            "public_id": public_id,
            "secure_url": url
        }

    async def delete_file(self, public_id: str) -> bool:
        if self.is_configured:
            try:
                import cloudinary.uploader
                await asyncio.to_thread(cloudinary.uploader.destroy, public_id)
                return True
            except Exception as e:
                logger.error(f"Cloudinary delete failed: {e}")
                return False
        return True

cloudinary_provider = CloudinaryStorageProvider()
