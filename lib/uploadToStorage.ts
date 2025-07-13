// Stub function – replace with actual upload logic (e.g. Supabase, S3, Firebase)
export async function uploadToStorage(file: File): Promise<string> {
  // simulate upload delay
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(URL.createObjectURL(file)); // simulate URL output
    }, 500);
  });
}
