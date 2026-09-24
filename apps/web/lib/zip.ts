/**
 * Zero-dependency client-side ZIP archive creator.
 * Packs files and triggers download as a standard .zip file in the browser.
 */

function makeCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
}

const CRC32_TABLE = makeCrc32Table();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC32_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

export function downloadZip(filename: string, files: { name: string; content: string }[]) {
  const encoder = new TextEncoder();
  const fileRecords: {
    nameBuf: Uint8Array;
    contentBuf: Uint8Array;
    crc: number;
    offset: number;
  }[] = [];

  const chunks: Uint8Array[] = [];
  let currentOffset = 0;

  // Write local file headers and data
  for (const f of files) {
    const nameBuf = encoder.encode(f.name);
    const contentBuf = encoder.encode(f.content);
    const crc = crc32(contentBuf);

    fileRecords.push({
      nameBuf,
      contentBuf,
      crc,
      offset: currentOffset,
    });

    const header = new Uint8Array(30);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); // Local file header signature
    view.setUint16(4, 20, true);         // Version needed to extract (2.0)
    view.setUint16(6, 0, true);          // General purpose bit flag
    view.setUint16(8, 0, true);          // Compression method (0 = uncompressed store)
    view.setUint16(10, 0, true);         // Last mod file time
    view.setUint16(12, 0, true);         // Last mod file date
    view.setUint32(14, crc, true);       // CRC-32
    view.setUint32(18, contentBuf.length, true); // Compressed size
    view.setUint32(22, contentBuf.length, true); // Uncompressed size
    view.setUint16(26, nameBuf.length, true);    // File name length
    view.setUint16(28, 0, true);                 // Extra field length

    chunks.push(header, nameBuf, contentBuf);
    currentOffset += header.length + nameBuf.length + contentBuf.length;
  }

  const centralDirStart = currentOffset;

  // Write central directory headers
  for (const r of fileRecords) {
    const cdHeader = new Uint8Array(46);
    const view = new DataView(cdHeader.buffer);
    view.setUint32(0, 0x02014b50, true); // Central file header signature
    view.setUint16(4, 20, true);         // Version made by
    view.setUint16(6, 20, true);         // Version needed to extract
    view.setUint16(8, 0, true);          // General purpose bit flag
    view.setUint16(10, 0, true);         // Compression method
    view.setUint16(12, 0, true);         // Last mod file time
    view.setUint16(14, 0, true);         // Last mod file date
    view.setUint32(16, r.crc, true);     // CRC-32
    view.setUint32(20, r.contentBuf.length, true); // Compressed size
    view.setUint32(24, r.contentBuf.length, true); // Uncompressed size
    view.setUint16(28, r.nameBuf.length, true);    // File name length
    view.setUint16(30, 0, true);                   // Extra field length
    view.setUint16(32, 0, true);                   // File comment length
    view.setUint16(34, 0, true);                   // Disk number start
    view.setUint16(36, 0, true);                   // Internal file attributes
    view.setUint32(38, 0, true);                   // External file attributes
    view.setUint32(42, r.offset, true);            // Relative offset of local header

    chunks.push(cdHeader, r.nameBuf);
    currentOffset += cdHeader.length + r.nameBuf.length;
  }

  const centralDirSize = currentOffset - centralDirStart;

  // Write End of central directory record (EOCD)
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);             // EOCD signature
  eocdView.setUint16(4, 0, true);                      // Number of this disk
  eocdView.setUint16(6, 0, true);                      // Disk where central directory starts
  eocdView.setUint16(8, fileRecords.length, true);     // Number of central directory records on this disk
  eocdView.setUint16(10, fileRecords.length, true);    // Total number of central directory records
  eocdView.setUint32(12, centralDirSize, true);        // Size of central directory
  eocdView.setUint32(16, centralDirStart, true);       // Offset of start of central directory
  eocdView.setUint16(20, 0, true);                     // ZIP comment length
  chunks.push(eocd);

  const blob = new Blob(chunks as BlobPart[], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".zip") ? filename : `${filename}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
