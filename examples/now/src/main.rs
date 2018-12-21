use log::{self, error};
use simple_logger;
use std::error::Error;

use http::StatusCode;
use lambda_runtime::{error::HandlerError, Context};
use now_rust::{lambda, IntoResponse, Request, Response};

fn main() -> Result<(), Box<dyn Error>> {
    simple_logger::init_with_level(log::Level::Debug).unwrap();
    lambda!(handler);

    Ok(())
}

pub fn handler(request: Request, _c: Context) -> Result<impl IntoResponse, HandlerError> {
    error!("Got to handler");
    let uri = request.uri();
    let response = Response::builder()
        .status(StatusCode::OK)
        .body(format!("You made a request to {}", uri))
        .expect("failed to render response");

    Ok(response)
}
