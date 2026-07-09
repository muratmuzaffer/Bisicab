import { supabase } from './supabase';

/**
 * Fiş fotoğrafını Supabase Storage'a yükler.
 * Dosya yolu `receipts/<driverId>/<tripId>.jpg` biçimindedir; RLS bu yola
 * göre yalnızca ilgili sürücüye yazma izni verir.
 *
 * @returns imzalı (signed) URL veya hata.
 */
export async function uploadReceipt(params: {
  driverId: string;
  tripId: string;
  fileUri: string;
}): Promise<{ url?: string; path?: string; error?: string }> {
  const { driverId, tripId, fileUri } = params;
  const path = `${driverId}/${tripId}.jpg`;

  try {
    const response = await fetch(fileUri);
    const arrayBuffer = await response.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(path, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) return { error: uploadError.message };

    // Bucket private olduğundan imzalı URL üretiyoruz (1 yıl geçerli).
    const { data: signed } = await supabase.storage
      .from('receipts')
      .createSignedUrl(path, 60 * 60 * 24 * 365);

    return { url: signed?.signedUrl, path };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Yükleme başarısız.' };
  }
}
