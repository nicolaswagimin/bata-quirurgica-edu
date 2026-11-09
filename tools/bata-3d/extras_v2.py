"""Configured scene extras and their validation; world metres, Z up, -Y front."""
from circulator_v2 import build_circulator, assert_sterile_clearance
from fastening_v2 import build_fastening
from back_closure_v2 import measure_back_gaps
from circulator_visibility_v2 import assert_hidden
from circulator_trim_v2 import choose_forearm_length


def build_extras(config, human, rig, gown, marks):
    """Ordered handlers are selected only by STEPS; empty extras change nothing."""
    context = {}
    handlers = {
        'back_fastening': lambda: build_fastening(gown, marks),
        'circulator': lambda: build_circulator(human, rig, context),
    }
    if 'loose_glove' in config['extras']:
        from gloves_v2 import loose_glove
        handlers['loose_glove'] = lambda: {'loose_glove': loose_glove(human, rig)}
    for name in config['extras']:
        context.update(handlers[name]())
    return context


def finalize_extra_geometry(config, context, gown):
    """Select a real forearm cut length, before the final triangle budget."""
    if 'circulator' in config['extras']:
        choose_forearm_length(gown, context)


def validate_extras(config, context, gown, cuffs, layouts, rig):
    """Validate configured extras after geometry reduction, world metres."""
    if 'circulator' in config['extras']:
        assert_hidden(gown, context)
    handlers = {
        'back_fastening': lambda: measure_back_gaps(gown, context['marks']),
        'circulator': lambda: assert_sterile_clearance(
            gown, cuffs, layouts, rig,
            context['circulator_hands']+context['circulator_clothing']),
    }
    for name in config['extras']:
        if name == 'loose_glove':
            continue
        handlers[name]()
