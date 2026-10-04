import unittest
from pathlib import Path
from corpus.ledger.tools.check_purity import check_source, check_package

class PurityTests(unittest.TestCase):
    def test_real_projection_dependency_closure(self):
        self.assertGreaterEqual(len(check_package(Path('.'))),5)

    def test_forbidden_dependencies_fail_structurally(self):
        for source in ['import time\nx=time.time()', 'from datetime import datetime\nx=datetime.now()', 'import socket', 'import requests', 'import os\nx=os.environ', 'import random', 'import importlib', 'x=__import__("os")', 'x=open("authority")', 'x=getattr(object,"now")', 'CACHE={}', 'import json as j\nx=j.sys.platform', 'from json import load as reader', 'import json\nCACHE=json.loads("{}")', 'class Authority:\n CACHE={}']:
            with self.subTest(source=source), self.assertRaises(ValueError): check_source(source,'projection')
