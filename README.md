# now-static-bin

This package provides a
[builder](https://zeit.co/docs/v2/deployments/builders/overview#when-to-use-builders)
for Zeit's [Now 2.0](https://zeit.co/blog/now-2) offering that enables running
Rust lambdas on Now's platform.

## Usage

Define a `main.rs` file inside a folder as follows:



Your `now.json` `"builds"` section should look something like this:

## Example

**Note**: don't forget to add `"version": 2` in your `now.json` file to use Now
2.0 explicitly.

```json
{
  "builds": [
    {
      "src": "Cargo.toml",
      "use": "@now/rust"
    }
  ]
}
```

## Copyright and License

Copyright © 2018 António Nuno Monteiro.

Distributed under the MIT License (see [LICENSE](./LICENSE)).
