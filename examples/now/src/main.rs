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
