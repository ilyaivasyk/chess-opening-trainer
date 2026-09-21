import struct
import sys
import zlib


def png(path: str, size: int) -> None:
    bg = (16, 21, 20, 255)
    gold = (216, 182, 106, 255)
    pixels = [[bg for _ in range(size)] for _ in range(size)]

    def rect(x1, y1, x2, y2, color):
        for y in range(max(0, y1), min(size, y2)):
            for x in range(max(0, x1), min(size, x2)):
                pixels[y][x] = color

    # Простий знак шахового коня, добре читабельний як мала іконка.
    s = size / 512
    rect(int(165*s), int(383*s), int(347*s), int(422*s), gold)
    rect(int(184*s), int(345*s), int(328*s), int(382*s), gold)
    for y in range(int(100*s), int(345*s)):
        progress = (y / s - 100) / 245
        left = int((232 - 82 * progress) * s)
        right = int((302 + 44 * progress) * s)
        rect(left, y, right, y + 1, gold)
    rect(int(213*s), int(92*s), int(294*s), int(162*s), gold)
    rect(int(248*s), int(113*s), int(266*s), int(131*s), bg)

    raw = b''.join(b'\x00' + bytes(channel for pixel in row for channel in pixel) for row in pixels)
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)
    payload = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    with open(path, 'wb') as file:
        file.write(payload)


png(sys.argv[1], int(sys.argv[2]))
