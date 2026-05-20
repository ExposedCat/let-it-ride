#!/bin/bash

DEBUG=${DEBUG:-"app:*"} deno run --watch --env-file=.env -A src/app.ts