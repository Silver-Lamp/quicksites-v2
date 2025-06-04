'use client';

import { useDropzone } from 'react-dropzone';
import { useImageUploader } from '@/admin/hooks/useImageUploader';

interface ImageUploaderProps {
  siteId: string;
  templateId: string;
  dbField: string;
  folder?: string;
  label: string;
  initialUrl?: string;
  onUpload?: (url: string | null) => void;
}

export default function ImageUploader(props: ImageUploaderProps) {
  const {
    preview,
    uploading,
    uploadImage,
    removeImage,
  } = useImageUploader({
    siteId: props.siteId,
    templateId: props.templateId,
    dbField: props.dbField,
    folder: props.folder,
    label: props.label,
    initialUrl: props.initialUrl,
    onChange: props.onUpload,
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': [] },
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (file) uploadImage(file);
    },
  });

  const getDropzoneSizeClass = (label?: string) => {
    if (!label) return 'h-40 w-full';
  
    const lower = label.toLowerCase();
  
    if (lower.includes('banner')) return 'h-32 w-full aspect-[4/1]';
    if (lower.includes('hero')) return 'h-64 w-full aspect-[2.5/1]';
    if (lower.includes('logo')) return 'h-32 w-32 aspect-square';
    if (lower.includes('team')) return 'h-48 w-full aspect-[3/2]';
  
    return 'h-40 w-full';
  };
  

  return (
    <div className="space-y-2">
      {props.label && <p className="text-xs text-white/70 font-medium">{props.label}</p>}

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg text-center cursor-pointer transition flex items-center justify-center
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
          ${getDropzoneSizeClass(props.label)}
        `}
      >
        <input {...getInputProps()} />
        <p className="text-sm text-gray-400">
          {isDragActive ? 'Drop the image here…' : 'Drag & drop an image, or click to select one'}
        </p>
      </div>

      {uploading && <p className="text-sm text-gray-500">Uploading...</p>}

      {preview && (
        <div className="relative max-w-xs">
          <img src={preview} alt="Uploaded" className="rounded border max-h-48" />
          <button
            type="button"
            onClick={removeImage}
            className="absolute top-1 right-1 bg-red-500 text-white px-2 py-1 text-xs rounded"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
