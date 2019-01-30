# now-static-bin

This package provides a
[builder](https://zeit.co/docs/v2/deployments/builders/overview#when-to-use-builders)
for Zeit's [Now 2.0](https://zeit.co/blog/now-2) offering that enables running
Rust lambdas on Now's platform.

## Usage

1. In your `src` diectory, define a `main.rs` file with your lambda, for
   example:

```rust
use http::StatusCode;
use lambda_runtime::{error::HandlerError, Context};
use now_rust::{lambda, IntoResponse, Request, Response};
use std::error::Error;

fn handler(request: Request, _c: Context) -> Result<impl IntoResponse, HandlerError> {
    let uri = request.uri();
    let response = Response::builder()
        .status(StatusCode::OK)
        .body(format!("You made a request to {}", uri))
        .expect("failed to render response");

    Ok(response)
}

fn main() -> Result<(), Box<dyn Error>> {
    Ok(lambda!(handler))
}
```

2. Define a `Cargo.toml` file with e.g. the following contents:

**Note**: The `@now/rust` builder infers the name of your lambda from the `name`
field `name` in `Cargo.toml`'s `[package]` section.

```toml
[package]
name = "my_rust_lambda"
version = "0.0.1"
edition = "2018"

[dependencies]
http = "0.1"
lambda_runtime = "0.2.0"

[dependencies.now_rust]
# Unreleased yet
git = "https://github.com/anmonteiro/now-rust"
rev = "master"
```

3. Write a `now.json` file that uses `@now/rust` to build the lambda:

**Note**: by default, if you don't specify a `"routes"` section, the lambda will
be available under the name that you specified in the `Cargo.toml`'s
`package.name` field. In our case this would be `/my_rust_lambda`.

```json
{
  "name": "my-rust-lambda",
  "public": true,
  "version": 2,
  "builds": [
    {
      "src": "Cargo.toml",
      "use": "@now/rust",
      "config": { "newPipeline": true }
    }
  ]
}
```

## Configuration options

- [`maxLambdaSize`](https://zeit.co/docs/v2/deployments/concepts/lambdas/#maximum-bundle-size):
  this setting is common to every Now v2 deployment. In `@now/rust`, it defaults
  to 25MB, and can be overridden up to 50MB.

## Copyright and License

Copyright © 2019 António Nuno Monteiro.

Distributed under the MIT License (see [LICENSE](./LICENSE)).
