"""
This file is derived from the eel example page. It sets up a basic eel environment that also
works with React and weppacked frontend.
This allows us to use npm modules in the frontend (i.e. React and D3) and at the same time gives
us TypeScript support in the frontend.

src:
https://github.com/samuelhwilliams/Eel/tree/master/examples/07%20-%20CreateReactApp

"""

import os
import platform
import random
import sys

import eel


@eel.expose  # Expose function to JavaScript
def say_hello_py(x):
    """Print message from JavaScript on app initialization, then call a JS function."""
    print('Hello from %s' % x)  # noqa T001
    eel.say_hello_js('Python {from within say_hello_py()}!')

    # test whether sending data works: Whenever a client registers (i.e. calls the hello method),
    # respond with data

    # eel.send_data_to_frontend([1, 2, 3, 4])


@eel.expose
def send_to_backend(x):
  print("received data")

def start_eel(develop):
    """Start Eel with either production or development configuration."""

    if develop:
        directory = '../frontend/src'
        app = None
        page = {'port': 3000}
    else:
        directory = 'build'
        app = 'chrome-app'
        page = 'index.html'

    eel.init(directory, ['.tsx', '.ts', '.jsx', '.js', '.html'])

    print('Backend launched successfully. Waiting for requests ...')

    # These will be queued until the first connection is made, but won't be repeated on a page reload
    eel.say_hello_js('Python World!')   # Call a JavaScript function (must be after `eel.init()`)

    eel_kwargs = dict(
        host='localhost',
        port=8080,
        size=(1280, 800),
    )
    try:
        eel.start(page, mode=None, **eel_kwargs)
    except EnvironmentError:
        # If Chrome isn't found, fallback to Microsoft Edge on Win10 or greater
        if sys.platform in ['win32', 'win64'] and int(platform.release()) >= 10:
            eel.start(page, mode='edge', **eel_kwargs)
        else:
            raise


if __name__ == '__main__':
    import sys

    # Uses the production version in the "build" directory if passed a second argument
    start_eel(develop=len(sys.argv) == 1)
