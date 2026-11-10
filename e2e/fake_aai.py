"""A stand-in for AssemblyAI's v3 streaming socket. Emits a final 'turn' for every 2 s of audio it receives.
DROP_FIRST_AFTER=<bytes>: abruptly kill the first connection once that many bytes arrived (simulates a network drop)."""
import asyncio, json, os, sys
import websockets

DROP = int(os.environ.get("DROP_FIRST_AFTER", "0"))
conns = 0
import time
REFUSE = float(os.environ.get('REFUSE_SECONDS', '0'))
dropped_at = None
BYTES_PER_TURN = 16000 * 2 * 2  # 2 s

async def handler(ws):
    global conns
    conns += 1
    n = conns
    global dropped_at
    if n > 1 and dropped_at and time.time() - dropped_at < REFUSE:
        print(f'conn {n} refused', flush=True)
        await ws.close()
        return
    print(f"conn {n} open", flush=True)
    await ws.send(json.dumps({"type": "Begin", "id": f"s{n}", "expires_at": 0}))
    got, turns = 0, 0
    try:
        async for msg in ws:
            if isinstance(msg, bytes):
                got += len(msg)
                while got >= (turns + 1) * BYTES_PER_TURN:
                    s = turns * 2000
                    w = [{"text": f"word{n}x{turns}", "start": s + 100, "end": s + 1800, "word_is_final": True}]
                    await ws.send(json.dumps({"type": "Turn", "turn_order": turns, "end_of_turn": True, "turn_is_formatted": True,
                                              "transcript": f"word{n}x{turns}", "words": w}))
                    turns += 1
                if n == 1 and DROP and got >= DROP:
                    print("dropping", flush=True)
                    dropped_at = time.time()
                    ws.transport.abort()
                    return
            else:
                if json.loads(msg).get("type") == "Terminate":
                    await ws.send(json.dumps({"type": "Termination", "audio_duration_seconds": got / 32000, "session_duration_seconds": got / 32000}))
                    await ws.close()
                    return
    except websockets.ConnectionClosed:
        pass
    print(f"conn {n} closed, {got} bytes", flush=True)

async def main():
    async with websockets.serve(handler, "127.0.0.1", 8765, max_size=None):
        await asyncio.Future()

asyncio.run(main())
