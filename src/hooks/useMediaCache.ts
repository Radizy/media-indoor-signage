import { useState, useEffect, useRef } from 'react';

/**
 * Hook para gerenciar cache offline das mídias usando a Cache Storage API do navegador.
 * Garante que se houver queda de rede, as mídias já baixadas continuem tocando.
 * Otimizado com reuso de object URLs e revogação imediata para evitar vazamento de memória.
 */
export function useMediaCache(urls: string[]) {
  const [cachedUrls, setCachedUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const activeBlobsRef = useRef<Record<string, string>>({});

  const urlsString = (urls || []).join(',');

  useEffect(() => {
    if (!urls || urls.length === 0) return;

    let isMounted = true;
    const cacheName = 'indoor-signage-media-cache';

    const cacheAllMedia = async () => {
      setLoading(true);
      const cache = await caches.open(cacheName);
      const newUrls: Record<string, string> = {};

      const currentBlobs = activeBlobsRef.current;
      const urlsSet = new Set(urls);

      // 1. Revoga blobs antigos de mídias que foram removidas da playlist atual
      Object.entries(currentBlobs).forEach(([originalUrl, objectUrl]) => {
        if (!urlsSet.has(originalUrl) && objectUrl.startsWith('blob:')) {
          URL.revokeObjectURL(objectUrl);
        }
      });

      // 2. Resolve e cria blobs apenas para novas mídias
      for (const url of urls) {
        if (!url) continue;
        
        // Ignora cache para links do YouTube
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
          newUrls[url] = url;
          continue;
        }

        try {
          // Se já temos um blob gerado para essa URL na rodada anterior, reutiliza
          if (currentBlobs[url] && currentBlobs[url].startsWith('blob:')) {
            newUrls[url] = currentBlobs[url];
            continue;
          }

          // Verifica se já está no Cache Storage
          const cachedResponse = await cache.match(url);
          if (cachedResponse) {
            const blob = await cachedResponse.blob();
            newUrls[url] = URL.createObjectURL(blob);
          } else {
            // Senão, faz download e adiciona ao cache
            const response = await fetch(url);
            if (response.ok) {
              await cache.put(url, response.clone());
              const blob = await response.blob();
              newUrls[url] = URL.createObjectURL(blob);
            } else {
              newUrls[url] = url; // Fallback para URL original em caso de erro
            }
          }
        } catch (error) {
          console.error(`Erro ao salvar mídia em cache offline (${url}):`, error);
          newUrls[url] = url; // Fallback
        }
      }

      if (isMounted) {
        activeBlobsRef.current = newUrls;
        setCachedUrls(newUrls);
        setLoading(false);
      } else {
        // Se desmontou antes de finalizar, revoga todos os novos blobs criados para evitar leaks
        Object.values(newUrls).forEach((objectUrl) => {
          if (objectUrl.startsWith('blob:')) {
            URL.revokeObjectURL(objectUrl);
          }
        });
      }
    };

    cacheAllMedia();

    return () => {
      isMounted = false;
    };
  }, [urlsString]);

  // Limpeza final ao desmontar o player por completo
  useEffect(() => {
    return () => {
      Object.values(activeBlobsRef.current).forEach((objectUrl) => {
        if (objectUrl.startsWith('blob:')) {
          URL.revokeObjectURL(objectUrl);
        }
      });
    };
  }, []);

  return { cachedUrls, loading };
}

