"""Quality-bounded reduction for extra scene geometry; triangle counts, metres."""
from circulator_v2 import HAND_TRIANGLE_FLOOR

CUFF_TRIANGLE_FLOOR = 4200  # per cuff; preserve the lip and visible 28 ribs


def fit_extra_budget(helpers, context, cuffs, limit=None, cuff_floor=CUFF_TRIANGLE_FLOOR):
    """If needed, reduce circulator skin first, knit second; never exceed floors.

    Empty extras and an in-budget scene perform no operations or extra prints,
    preserving the approved step's exact geometry/counts.
    """
    count = helpers['triangles']
    total = lambda: sum(count(obj) for obj in helpers['visible_objects']())
    limit = helpers['MAX_TRIANGLES'] if limit is None else limit
    if total() <= limit:
        return
    priority = [(obj, HAND_TRIANGLE_FLOOR) for obj in context.get('circulator_hands', [])]
    priority += [(obj, cuff_floor) for obj in cuffs]
    for obj, floor in priority:
        excess = total()-limit
        if excess <= 0:
            return
        before = count(obj)
        # Floor reserve and 16-triangle headroom absorb modifier rounding.
        target = max(int(floor*1.01), before-excess-16)
        if target >= before:
            continue
        helpers['decimate'](obj, target/before)
        after = count(obj)
        print('BUDGET quality reduction', obj.name, before, '->', after, 'floor', floor)
        assert after >= floor, f'{obj.name}: quality floor violated'
    if total() > limit:
        raise RuntimeError(f'OVER BUDGET with quality floors: {total()} > {limit}')
