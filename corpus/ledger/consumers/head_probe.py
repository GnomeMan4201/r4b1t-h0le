"""Explicit network observer outside the pure replay/selection dependency graphs."""
from datetime import datetime,timezone
import hashlib
import requests
from tools.maintain_corpus import request
from pool_sweep import PublicTargetGuard,RateLimiter,TargetGuardError
from corpus.ledger.schema.events import url
from corpus.ledger.schema.serialization import serialize
from .probe_windows import PROBE

HEADERS=('content-type','content-length','cache-control','etag','last-modified','location')


def now():
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')


def observe(resource_id,target,guard,limiter,clock=now):
    url(target)
    payload={'probe_version':PROBE,'observed_url':target,'started_at':clock()}
    try:
        response,final=request('HEAD',target,{},guard,limiter,timeout=8)
        try:
            headers={k.lower():str(v) for k,v in response.headers.items() if k.lower() in HEADERS}
            payload.update(status=response.status_code,final_url=final,headers_digest='sha256:'+hashlib.sha256(serialize(headers).encode('utf-8')).hexdigest())
        finally: response.close()
    except (requests.exceptions.RequestException,TargetGuardError,ValueError,OSError) as error:
        payload['reason']=type(error).__name__
    payload['finished_at']=clock()
    return {'resource_id':resource_id,'payload':payload}
