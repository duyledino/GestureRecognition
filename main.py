from uvicorn import run
def main():
    print("Hello from gesture-req-system!")
    run("app.main:app", host="localhost", port=8000, reload=True)

if __name__ == "__main__":
    main()
