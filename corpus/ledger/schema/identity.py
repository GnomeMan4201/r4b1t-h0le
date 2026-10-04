"""Identity parsing only. Minting is private to the single sequencer."""
import re

MAX_CREATE_SEQ = 999_999_999_999_999


def create_seq(resource_id):
    if not isinstance(resource_id, str) or not re.fullmatch(r'r4b1t:r:[0-9]{15}', resource_id):
        raise ValueError('invalid v1 resource ID')
    value = int(resource_id[8:])
    if not 1 <= value <= MAX_CREATE_SEQ:
        raise ValueError('create_seq outside v1 encoding')
    return value


def survivor(first, second):
    if first == second:
        raise ValueError('merge needs two distinct identities')
    return min((first, second), key=create_seq)
