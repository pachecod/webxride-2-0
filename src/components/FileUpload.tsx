import React, { useState, useRef } from 'react';
import { Upload, X } from 'lucide-react';
import { supabase, getFileType, getContentType } from '../lib/supabase';
import { resizeImage } from '../lib/image-utils';

interface FileUploadProps {
  onUploadComplete: (url: string) => void;
  onFilesChanged: () => void;
  selectedUser: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onUploadComplete, onFilesChanged, selectedUser }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [totalFiles, setTotalFiles] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceInfo, setSourceInfo] = useState('');
  const [showSourceFields, setShowSourceFields] = useState(false);
  const singleFileInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | File[]) => {
    setIsUploading(true);
    setTotalFiles(files.length);
    setCurrentFileIndex(0);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setCurrentFileIndex(i);
      
      try {
        const extension = file.name.split('.').pop()?.toLowerCase() || '';
        const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'));
        const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9.-]/g, '-');
        const uniqueId = Date.now();
        const fileName = `${sanitizedName}_${uniqueId}.${extension}`;
        const fileType = getFileType(extension);
        const filePath = `${selectedUser}/${fileType}/${fileName}`;

        const contentType = file.type || getContentType(extension);

        // If image, generate preview and thumbnail
        if (fileType === 'images') {
          // Generate preview (600px wide)
          const previewBlob = await resizeImage(file, 600, 0.85);
          const previewName = `${sanitizedName}_${uniqueId}_preview.jpg`;
          const previewPath = `${selectedUser}/${fileType}/${previewName}`;
          await supabase.storage.from('files').upload(previewPath, previewBlob, {
            cacheControl: '3600',
            upsert: false,
            contentType: 'image/jpeg',
          });

          // Generate thumbnail (100px wide, lower quality for faster loading)
          const thumbBlob = await resizeImage(file, 100, 0.6);
          const thumbName = `${sanitizedName}_${uniqueId}_thumb.jpg`;
          const thumbPath = `${selectedUser}/${fileType}/${thumbName}`;
          await supabase.storage.from('files').upload(thumbPath, thumbBlob, {
            cacheControl: '3600',
            upsert: false,
            contentType: 'image/jpeg',
          });
        }

        const metadata = {
          sourceUrl: sourceUrl.trim() || null,
          sourceInfo: sourceInfo.trim() || null,
          uploadedBy: selectedUser,
          uploadedAt: new Date().toISOString()
        };
        
        console.log('Uploading with metadata:', metadata);

        const { error: uploadError } = await supabase.storage
          .from('files')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true,
            contentType,
            metadata: {
              sourceUrl: metadata.sourceUrl,
              sourceInfo: metadata.sourceInfo,
              uploadedBy: metadata.uploadedBy,
              uploadedAt: metadata.uploadedAt
            }
          });

        if (uploadError) {
          console.error(`Upload error for ${file.name}:`, uploadError);
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('files')
          .getPublicUrl(filePath);

        console.log(`Successfully uploaded ${file.name}, public URL:`, publicUrl);
        onUploadComplete(publicUrl);
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';
        alert(`Failed to upload ${file.name}: ${errorMessage}`);
      }
    }

    setIsUploading(false);
    setUploadProgress(0);
    setTotalFiles(0);
    setCurrentFileIndex(0);
    setIsModalOpen(false);
    // Reset source fields
    setSourceUrl('');
    setSourceInfo('');
    setShowSourceFields(false);
    onFilesChanged();
  };

  const handleSingleFileSelect = () => {
    singleFileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;
    handleFiles(files);
    event.target.value = '';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length) {
      handleFiles(files);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="flex items-center justify-center p-2 rounded hover:bg-gray-700 transition-colors"
        disabled={isUploading}
      >
        <Upload size={18} />
      </button>

      <input
        ref={singleFileInputRef}
        type="file"
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        ref={multiFileInputRef}
        type="file"
        onChange={handleFileSelect}
        className="hidden"
        multiple
      />

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Upload Files</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-gray-700 rounded"
              >
                <X size={20} />
              </button>
            </div>

            {isUploading ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-300">
                  {totalFiles > 1 
                    ? `Uploading file ${currentFileIndex + 1} of ${totalFiles} (${uploadProgress}%)`
                    : `Uploading... ${uploadProgress}%`
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Source Attribution Section */}
                <div className="border border-gray-600 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-300">Source Attribution (Optional)</h3>
                    <button
                      onClick={() => setShowSourceFields(!showSourceFields)}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      {showSourceFields ? 'Hide' : 'Add Source Info'}
                    </button>
                  </div>
                  
                  {showSourceFields && (
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="sourceUrl" className="block text-xs text-gray-400 mb-1">
                          Source URL
                        </label>
                        <input
                          type="url"
                          id="sourceUrl"
                          value={sourceUrl}
                          onChange={(e) => setSourceUrl(e.target.value)}
                          placeholder="https://example.com/source"
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label htmlFor="sourceInfo" className="block text-xs text-gray-400 mb-1">
                          Source Information
                        </label>
                        <textarea
                          id="sourceInfo"
                          value={sourceInfo}
                          onChange={(e) => setSourceInfo(e.target.value)}
                          placeholder="Artist name, license, attribution requirements, etc."
                          rows={3}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleSingleFileSelect}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  Upload a Single File
                </button>

                <div
                  className={`
                    border-2 border-dashed rounded-lg p-8 text-center transition-colors
                    ${isDragging ? 'border-blue-500 bg-blue-500 bg-opacity-10' : 'border-gray-600 hover:border-gray-500'}
                  `}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => multiFileInputRef.current?.click()}
                >
                  <p className="text-gray-300 mb-2">Upload Multiple Files</p>
                  <p className="text-sm text-gray-500">
                    {isDragging ? 'Drop files here' : 'Drag & drop files here or click to select'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};