"""Build every GLB from the content files. Run: python3 tools/blender/build_all.py"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from lib import reset, export

def run(module_name, filename):
    reset()
    lib._mats.clear()
    mod = __import__(module_name)
    root = mod.build()
    export(filename, [root])

if __name__ == "__main__":
    run("falcon", "falcon.glb")
    run("pole", "pole.glb")
    run("street", "street.glb")
    run("wing", "wing.glb")
