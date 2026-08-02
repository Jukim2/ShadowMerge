"""Generate the first modular observatory room and export it as GLB.

Run headlessly from the project root:
    blender --background --python tools/blender/create_observatory.py -- public/assets/observatory-room.glb

The script intentionally creates a fresh scene. Run it against an empty/background
Blender process, not an open artist scene containing unsaved work.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import bpy


def output_path() -> Path:
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    destination = args[0] if args else "public/assets/observatory-room.glb"
    return Path(destination).expanduser().resolve()


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (bpy.data.meshes, bpy.data.curves, bpy.data.materials):
        for item in list(collection):
            if item.users == 0:
                collection.remove(item)


def material(name: str, color: tuple[float, float, float, float], metallic: float, roughness: float):
    result = bpy.data.materials.new(name)
    result.diffuse_color = color
    result.use_nodes = True
    principled = result.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Metallic IOR Level"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness
    return result


def add_box(name: str, location, scale, mat, bevel: float = 0.04):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    modifier = obj.modifiers.new(name="Edge softness", type="BEVEL")
    modifier.width = bevel
    modifier.segments = 3
    return obj


def add_ring(name: str, location, rotation, major_radius: float, minor_radius: float, mat):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=64,
        minor_segments=12,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return obj


def add_socket(name: str, location) -> None:
    empty = bpy.data.objects.new(name, None)
    empty.empty_display_type = "PLAIN_AXES"
    empty.empty_display_size = 0.18
    empty.location = location
    empty["umbra_socket"] = True
    bpy.context.scene.collection.objects.link(empty)


def build_scene() -> None:
    reset_scene()

    brass = material("OBS_Brass", (0.34, 0.22, 0.11, 1.0), 0.76, 0.28)
    dark_metal = material("OBS_DarkMetal", (0.035, 0.055, 0.075, 1.0), 0.82, 0.24)
    stone = material("OBS_Stone", (0.12, 0.15, 0.17, 1.0), 0.04, 0.82)

    # The central opening is deliberately empty: the web renderer owns the shadow receiver.
    add_box("Frame_Left", (-2.52, 0.0, 0.0), (0.12, 0.22, 2.35), brass)
    add_box("Frame_Right", (2.52, 0.0, 0.0), (0.12, 0.22, 2.35), brass)
    add_box("Frame_Top", (0.0, 0.0, 2.23), (2.62, 0.22, 0.12), brass)

    add_box("Floor", (0.0, 0.7, -2.36), (4.2, 4.5, 0.15), stone, 0.02)
    add_box("Pedestal_Base", (0.0, 0.18, -1.85), (1.15, 0.85, 0.12), dark_metal)

    for index, radius in enumerate((1.25, 1.62, 2.02)):
        add_ring(
            f"Orrery_Ring_{index + 1}",
            (0.0, 0.64 + index * 0.05, 0.0),
            (math.radians(90), math.radians(index * 17), 0.0),
            radius,
            0.025,
            brass,
        )

    for side in (-1, 1):
        x = side * 3.25
        add_box(f"Column_{'L' if side < 0 else 'R'}", (x, 0.65, 0.0), (0.25, 0.25, 2.5), dark_metal)
        add_ring(
            f"Dial_{'L' if side < 0 else 'R'}",
            (x, 0.35, 0.55),
            (math.radians(90), 0.0, 0.0),
            0.48,
            0.035,
            brass,
        )

    add_socket("SOCKET_Puzzle", (0.0, 0.0, 0.0))
    add_socket("SOCKET_Prop_Left", (-3.15, 0.0, -1.65))
    add_socket("SOCKET_Prop_Right", (3.15, 0.0, -1.65))
    add_socket("SOCKET_Light", (0.0, 3.5, 1.2))

    scene = bpy.context.scene
    scene["umbra_theme_id"] = "brass-observatory"
    scene["umbra_units"] = "meters"


def export_scene(destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(destination),
        export_format="GLB",
        export_apply=True,
        export_extras=True,
        export_yup=True,
    )
    print(f"UMBRA_EXPORT={destination}")


if __name__ == "__main__":
    build_scene()
    export_scene(output_path())
