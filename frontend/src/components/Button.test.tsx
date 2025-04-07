import React from "react";
import { render, screen } from "@testing-library/react";
import { Button } from "./Button";

describe("<Button>", () => {
  it("respects the disabled prop", () => {
    render(<Button disabled>Click me</Button>);

    const button = screen.getByRole("button", { name: "Click me" });

    expect(button).toBeDisabled();
  });
});
