import os
import sys
import subprocess
import time
import webbrowser

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    server_dir = os.path.join(base_dir, "server")
    server_script = os.path.join(server_dir, "src", "index.js")

    print("=" * 60)
    print("  ZERO-LAG PRO TRADING TERMINAL")
    print("  MoneyControl Realtime Engine & TradingView Charts")
    print("  URL: http://localhost:4000")
    print("=" * 60)
    print()

    # Check Node.js
    try:
        node_ver = subprocess.check_output(["node", "--version"], text=True).strip()
        print(f"[OK] Node.js runtime detected: {node_ver}")
    except Exception:
        print("[ERROR] Node.js is not found. Please install Node.js (v18+) to run this project.")
        input("Press Enter to exit...")
        sys.exit(1)

    if not os.path.exists(server_script):
        print(f"[ERROR] Server file not found at: {server_script}")
        input("Press Enter to exit...")
        sys.exit(1)

    print("[OK] Starting backend server on http://localhost:4000 ...")
    proc = subprocess.Popen(["node", server_script], cwd=base_dir)

    # Wait 1.5 seconds for server to bind port, then launch browser
    time.sleep(1.5)
    print("[OK] Opening web browser at http://localhost:4000 ...")
    webbrowser.open("http://localhost:4000")

    print()
    print("------------------------------------------------------------")
    print("Terminal is LIVE! Keep this window open.")
    print("Press Ctrl+C in this window anytime to stop the server.")
    print("------------------------------------------------------------")
    print()

    try:
        proc.wait()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()
        print("Server stopped cleanly.")

if __name__ == "__main__":
    main()
