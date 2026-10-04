"""Fail CI on forbidden sources in the complete project-owned replay dependency closure."""
import ast
from pathlib import Path

MODULES = ('corpus.ledger.consumers.discovery','corpus.ledger.consumers.archive_windows','corpus.ledger.projection','corpus.ledger.schema.events','corpus.ledger.schema.identity','corpus.ledger.schema.serialization','tools.cj1')
STDLIB = ('__future__','re','json','hashlib','typing','ipaddress','urllib.parse')
FORBIDDEN_CALLS = ('open','eval','exec','compile','__import__','globals','locals','getattr','setattr','vars','input','breakpoint')
FORBIDDEN_ATTRS = ('now','utcnow','today','time','monotonic','perf_counter','environ','getenv','urandom','random','randint','randrange','socket','connect','request','urlopen','load','read','write','read_text','read_bytes','glob','iterdir','system','popen')


def check_source(source, module):
    tree = ast.parse(source)
    aliases = {}
    approved_symbols = {'__future__':('annotations',),'re':('compile','fullmatch','search'),'json':('loads','dumps'),'hashlib':('sha256',),'typing':('Any',),'ipaddress':('IPv6Address',),'urllib.parse':('urlsplit',)}
    def immutable_default(value):
        return isinstance(value,ast.Constant) or isinstance(value,ast.Tuple) and all(immutable_default(item) for item in value.elts)
    for node in ast.walk(tree):
        if isinstance(node,ast.Name) and isinstance(node.ctx,ast.Load) and node.id in FORBIDDEN_CALLS: raise ValueError('forbidden replay builtin reference')
        if isinstance(node,(ast.FunctionDef,ast.AsyncFunctionDef)):
            if any(not immutable_default(value) for value in node.args.defaults + [v for v in node.args.kw_defaults if v is not None]): raise ValueError('nonconstant replay default forbidden')
        if isinstance(node,(ast.Global,ast.Nonlocal)): raise ValueError('mutable global authority forbidden')
        if isinstance(node,ast.Import):
            for item in node.names:
                if item.name not in STDLIB and item.name not in MODULES: raise ValueError('import outside replay allowlist: '+item.name)
                aliases[item.asname or item.name] = item.name
        if isinstance(node,ast.ImportFrom):
            if node.level:
                base = module.split('.')[:-node.level]
                target = '.'.join(base + (node.module or '').split('.'))
            else: target=node.module
            if target not in STDLIB and target not in MODULES: raise ValueError('import outside replay allowlist: '+str(target))
            if any(item.name=='*' for item in node.names): raise ValueError('wildcard import forbidden')
            if target in STDLIB and any(item.name not in approved_symbols[target] for item in node.names): raise ValueError('symbol outside replay allowlist')
        if isinstance(node,ast.Call) and isinstance(node.func,ast.Name) and node.func.id in FORBIDDEN_CALLS: raise ValueError('forbidden replay call: '+node.func.id)
        if isinstance(node,ast.Attribute) and (node.attr in FORBIDDEN_ATTRS or node.attr.startswith('__')): raise ValueError('forbidden replay access: '+node.attr)
    for node in ast.walk(tree):
        if isinstance(node,ast.Attribute) and isinstance(node.value,ast.Name) and node.value.id in aliases:
            module_name=aliases[node.value.id]
            if module_name in STDLIB and node.attr not in approved_symbols[module_name]: raise ValueError('module access outside replay allowlist')
    top_nodes = list(tree.body)
    for node in tree.body:
        if isinstance(node,ast.ClassDef): top_nodes.extend(node.body)
    for node in top_nodes:
        if isinstance(node,(ast.Assign,ast.AnnAssign)):
            value=node.value
            if isinstance(value,ast.Call) and not (isinstance(value.func,ast.Attribute) and isinstance(value.func.value,ast.Name) and value.func.value.id=='re' and value.func.attr=='compile'):
                raise ValueError('computed module-level authority forbidden')
            if any(isinstance(n,(ast.Dict,ast.List,ast.Set,ast.DictComp,ast.ListComp,ast.SetComp)) for n in ast.walk(value)) or isinstance(value,ast.Call) and isinstance(value.func,ast.Name) and value.func.id in ('dict','list','set'):
                raise ValueError('mutable module-level state forbidden')
    return tree


def check_package(root):
    checked=[]
    for module in MODULES:
        path=Path(root)/Path(module.replace('.','/')+'.py')
        check_source(path.read_text('utf-8'),module)
        checked.append(str(path))
    return checked


if __name__ == '__main__':
    print('REPLAY PURITY VERIFIED:',len(check_package(Path('.'))),'modules')
