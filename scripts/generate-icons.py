import subprocess
import sys
from pathlib import Path


def png(path: str, size: int) -> None:
    source = Path(__file__).resolve().parent.parent / 'assets' / 'app-icon-source.png'
    subprocess.run(
        ['sips', '-z', str(size), str(size), str(source), '--out', path],
        check=True,
    )


png(sys.argv[1], int(sys.argv[2]))
