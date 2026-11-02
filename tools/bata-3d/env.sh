# Isolated Blender profile for the 3D asset pipeline.
_BATA3D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export BLENDER_USER_EXTENSIONS="$_BATA3D/.work/blender/extensions"
export BLENDER_USER_CONFIG="$_BATA3D/.work/blender/config"
export BLENDER_USER_SCRIPTS="$_BATA3D/.work/blender/scripts"
export BLENDER_USER_DATAFILES="$_BATA3D/.work/blender/datafiles"
