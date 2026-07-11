import { supabase } from './supabase';

/**
 * Fiş fotoğrafını Supabase Storage'a yükler.
 * DB'de saklanan değer storage path'tir (`<driverId>/<tripId>.jpg`);
 * görüntüleme için imzalı URL ayrıca üretilir (admin + mobil).
 */
export async function uploadReceipt(params: {
  tripId: string;
  fileUri: string;
}): Promise<{ path?: string; url?: string; error?: string }> {
  const { tripId, fileUri } = params;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Oturum bulunamadı.' };

  const path = `${user.id}/${tripId}.jpg`;

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

    const { data: signed } = await supabase.storage
      .from('receipts')
      .createSignedUrl(path, 60 * 60 * 24 * 365);

    // path kalıcı referans; url anlık önizleme için.
    return { path, url: signed?.signedUrl };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Yükleme başarısız.' };
  }
}

/** Storage path veya eski imzalı URL'den görüntülenebilir URL üretir. */
export async function resolveReceiptUrl(
  stored: string | null | undefined
): Promise<string | null> {
  if (!stored) return null;
  if (stored.startsWith('http://') || stored.startsWith('https://')) {
    // Eski kayıt: imzalı URL. Mümkünse path çıkar; olmazsa olduğu gibi kullan.
    const marker = '/object/sign/receipts/';
    const idx = stored.indexOf(marker);
    if (idx >= 0) {
      const after = stored.slice(idx + marker.length);
      const path = decodeURIComponent(after.split('?')[0] ?? '');
      if (path) {
        const { data } = await supabase.storage
          .from('receipts')
          .createSignedUrl(path, 60 * 60 * 24);
        if (data?.signedUrl) return data.signedUrl;
      }
    }
    return stored;
  }
  const { data } = await supabase.storage
    .from('receipts')
    .createSignedUrl(stored, 60 * 60 * 24);
  return data?.signedUrl ?? null;
}
