"""Inventory file metadata only. Does not parse, copy, upload, or embed documents."""
import argparse
import collections
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('source', type=Path)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
source = args.source.resolve(strict=True)
files = sorted(path for path in source.rglob('*') if path.is_file())
rows = [{'path': path.relative_to(source).as_posix(), 'bytes': path.stat().st_size, 'extension': path.suffix.lower()} for path in files]
report = {'mode': 'metadata_only', 'file_count': len(rows), 'total_bytes': sum(row['bytes'] for row in rows), 'by_extension': dict(collections.Counter(row['extension'] for row in rows)), 'over_20_mib': [row for row in rows if row['bytes'] > 20 * 1024 * 1024], 'files': rows}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({key: value for key, value in report.items() if key != 'files'}, ensure_ascii=False))
