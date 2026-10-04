# Synthetic archive records fixture

Seven canonical core events: genesis, CANDIDATE creation, target declaration,
recorded HEAD success, explicit replacement, explicit loss and inclusion marker.
The marker closes at the final declaration timestamp while preserving the actual
probe finish timestamp. Final target and probe state are unknown/absent; no state
axis changes. Expected record bytes are a literal worked result.

All URLs, observations, genesis commitments and evidence digests are synthetic.
This is a core-chain/consumer-record fixture, not a full boundary export or a
window witness. It makes no claim about real archives, remote responses, producer
execution, or heartbeat inclusion verification without the omitted artifacts.
