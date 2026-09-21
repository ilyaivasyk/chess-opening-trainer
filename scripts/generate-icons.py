import subprocess
import sys
from pathlib import Path


def png(path: str, size: int) -> None:
    svg = Path(__file__).resolve().parent.parent / 'public' / 'icon.svg'
    subprocess.run(
        ['rsvg-convert', '--width', str(size), '--height', str(size), '--output', path, str(svg)],
        check=True,
    )


png(sys.argv[1], int(sys.argv[2]))
