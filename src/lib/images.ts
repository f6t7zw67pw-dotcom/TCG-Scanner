export async function compressImage(file: File, maxEdge = 1400): Promise<string> {
  const source = await createImageBitmap(file);
  const factor = Math.min(1, maxEdge / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.width * factor));
  canvas.height = Math.max(1, Math.round(source.height * factor));
  canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close();
  return canvas.toDataURL('image/jpeg', 0.84);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Bild konnte nicht verarbeitet werden.'));
    image.src = src;
  });
}

export async function cropGrid(src: string, columns: number, rows: number): Promise<string[]> {
  const image = await loadImage(src);
  const source = document.createElement('canvas');
  source.width = image.naturalWidth;
  source.height = image.naturalHeight;
  source.getContext('2d')?.drawImage(image, 0, 0);
  const padX = source.width * 0.045;
  const padY = source.height * 0.05;
  const cellW = (source.width - padX * 2) / columns;
  const cellH = (source.height - padY * 2) / rows;
  const crops: string[] = [];
  for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
    const crop = document.createElement('canvas');
    crop.width = Math.max(1, Math.round(cellW * 0.92));
    crop.height = Math.max(1, Math.round(cellH * 0.92));
    crop.getContext('2d')?.drawImage(source, padX + column * cellW + cellW * 0.04, padY + row * cellH + cellH * 0.04, crop.width, crop.height, 0, 0, crop.width, crop.height);
    crops.push(crop.toDataURL('image/jpeg', 0.88));
  }
  return crops;
}

export async function runLimited<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  async function consume() {
    while (next < items.length) {
      const index = next++;
      try { results[index] = { status: 'fulfilled', value: await worker(items[index], index) }; }
      catch (reason) { results[index] = { status: 'rejected', reason }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, consume));
  return results;
}
