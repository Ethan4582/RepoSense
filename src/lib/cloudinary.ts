export async function uploadFile(file: File, setProgress?: (progress: number) => void): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = "ml_default"; 
     const folder = "reposense";


    if (!cloudName || !uploadPreset) {
      reject(new Error("Cloudinary config missing"));
      return;
    }

    const url = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
    const formData = new FormData();
    formData.append("file", file);
   formData.append("upload_preset", uploadPreset);
     formData.append("folder", folder);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    xhr.upload.onprogress = (event) => {
      if (setProgress && event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText) as { secure_url?: string };
        if (response.secure_url) resolve(response.secure_url);
        else reject(new Error("Failed to upload file"));
      } else {
        reject(new Error("Failed to upload file"));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Failed to upload file"));
    };

    xhr.send(formData);
  });
}