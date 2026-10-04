"""Contain declared artifact I/O to an explicit root, including symlink resolution."""
from pathlib import Path


def contained(root, relative):
    root=Path(root).resolve()
    if not isinstance(relative,str) or not relative or '\\' in relative or Path(relative).is_absolute() or '..' in relative.split('/'):
        raise ValueError('relative contained artifact path required')
    target=(root/relative).resolve()
    if not target.is_relative_to(root): raise ValueError('artifact symlink escapes declared root')
    return target
