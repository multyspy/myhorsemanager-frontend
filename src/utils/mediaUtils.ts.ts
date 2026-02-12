import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Alert, Platform } from 'react-native';

const MAX_FILE_SIZE_KB = 250; // Maximum file size in KB
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_KB * 1024;

/**
 * Compress an image to be under the maximum file size
 * @param uri - The URI of the image to compress
 * @param maxSizeKB - Maximum size in KB (default 250)
 * @returns Promise with the compressed image as base64 string
 */
export const compressImage = async (
  uri: string,
  maxSizeKB: number = MAX_FILE_SIZE_KB
): Promise<string | null> => {
  try {
    const maxSizeBytes = maxSizeKB * 1024;
    let quality = 0.8;
    let width = 1200; // Start with reasonable width
    let compressedUri = uri;
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      // Manipulate the image
      const manipResult = await ImageManipulator.manipulateAsync(
        compressedUri === uri ? uri : compressedUri,
        [{ resize: { width } }],
        {
          compress: quality,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      if (manipResult.base64) {
        const sizeBytes = (manipResult.base64.length * 3) / 4; // Approximate size from base64
        
        if (sizeBytes <= maxSizeBytes) {
          console.log(`Image compressed successfully: ${Math.round(sizeBytes / 1024)} KB`);
          return `data:image/jpeg;base64,${manipResult.base64}`;
        }

        // Reduce quality and size for next iteration
        quality = Math.max(0.3, quality - 0.15);
        width = Math.max(400, width - 200);
        compressedUri = manipResult.uri;
      }
      
      attempts++;
    }

    // Final attempt with minimum settings
    const finalResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 400 } }],
      {
        compress: 0.3,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );

    if (finalResult.base64) {
      const finalSize = (finalResult.base64.length * 3) / 4;
      console.log(`Final image size: ${Math.round(finalSize / 1024)} KB`);
      return `data:image/jpeg;base64,${finalResult.base64}`;
    }

    return null;
  } catch (error) {
    console.error('Error compressing image:', error);
    return null;
  }
};

/**
 * Validate and process a PDF file
 * @param uri - The URI of the PDF
 * @param fileName - The name of the file
 * @param maxSizeKB - Maximum size in KB (default 250)
 * @returns Promise with the PDF as base64 string or null if too large
 */
export const processPDF = async (
  uri: string,
  fileName: string,
  maxSizeKB: number = MAX_FILE_SIZE_KB
): Promise<{ data: string; name: string; sizeKB: number } | null> => {
  try {
    const maxSizeBytes = maxSizeKB * 1024;
    
    // Read the file
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const sizeBytes = (base64.length * 3) / 4;
    const sizeKB = Math.round(sizeBytes / 1024);

    if (sizeBytes > maxSizeBytes) {
      return null; // File too large
    }

    return {
      data: `data:application/pdf;base64,${base64}`,
      name: fileName,
      sizeKB,
    };
  } catch (error) {
    console.error('Error processing PDF:', error);
    return null;
  }
};

/**
 * Get file size from a URI
 * @param uri - The file URI
 * @returns Size in KB
 */
export const getFileSizeKB = async (uri: string): Promise<number> => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (fileInfo.exists && 'size' in fileInfo) {
      return Math.round((fileInfo.size || 0) / 1024);
    }
    return 0;
  } catch (error) {
    console.error('Error getting file size:', error);
    return 0;
  }
};

/**
 * Show alert for file too large
 * @param fileName - Name of the file
 * @param actualSizeKB - Actual size in KB
 * @param maxSizeKB - Maximum allowed size in KB
 */
export const showFileTooLargeAlert = (
  fileName: string,
  actualSizeKB: number,
  maxSizeKB: number = MAX_FILE_SIZE_KB,
  t?: (key: string) => string
) => {
  const title = t ? t('fileTooLarge') : 'Archivo muy grande';
  const message = t 
    ? `${fileName} (${actualSizeKB} KB) ${t('exceedsMaxSize')} ${maxSizeKB} KB`
    : `${fileName} (${actualSizeKB} KB) excede el tamaño máximo de ${maxSizeKB} KB`;
  
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

export const MAX_SIZE_KB = MAX_FILE_SIZE_KB;
