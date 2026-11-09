"""Pure cloth profiles for preparation scenes; metres, no Blender imports."""
import math


def held_fold(u, t):
    """Three unequal broad folds with drifting crests; no periodic fluting."""
    folds = ((-.62+.09*t, .24, .029), (.03-.13*t, .32, -.036),
             (.66-.06*t*t, .21, .023))
    return sum(height*math.exp(-((u-center)/width)**2)
               for center, width, height in folds)*(.45+.55*t)


def towel_section(t, radius):
    """Wrap 210 degrees around forearm; both unequal free ends fall with gravity.

    Returns radial horizontal/vertical coordinates about the arm, plus tail
    weight for gravity pleats. The circular contact arc has no skin penetration.
    """
    angle = math.radians(105)
    if .25 <= t <= .70:
        theta = -angle+(t-.25)/.45*2*angle
        return radius*math.sin(theta), radius*math.cos(theta), 0.0
    left = t < .25
    distance = (.25-t)*.64 if left else (t-.70)*.48
    sign = -1 if left else 1
    return (sign*(radius*math.sin(angle)+.018*(1-math.exp(-distance/.035))),
            radius*math.cos(angle)-distance, distance)


def shoulder_radius(t, angle):
    """Soft rounded hand hood flowing into a hanging sleeve, no planar cards."""
    radius = .068*(1-t)+.040*t
    return radius+.0035*math.sin(2*angle+t*9)*math.sin(math.pi*t)**2
