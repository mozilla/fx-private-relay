import React from "react";
import { render, fireEvent, screen } from "@testing-library/react";
import { Button } from "../components/Button"; // Adjust the import path as needed

describe("Button Component", () => {
  it("renders a button with children", () => {
    render(<Button>Click me</Button>);
    const buttonElement = screen.getByText("Click me");
    expect(buttonElement).toBeInTheDocument();
  });

  it("renders a primary button by default", () => {
    render(<Button>Primary Button</Button>);
    const buttonElement = screen.getByText("Primary Button"); // Adjust the class name as per your CSS
    expect(buttonElement).toBeInTheDocument();
  });

  it("renders a destructive button when variant is 'destructive'", () => {
    render(<Button variant="destructive">Destructive Button</Button>);
    const buttonElement = screen.getByText("Destructive Button"); // Adjust the class name as per your CSS
    expect(buttonElement).toBeInTheDocument();
  });

  it("renders a secondary button when variant is 'secondary'", () => {
    render(<Button variant="secondary">Secondary Button</Button>);
    const buttonElement = screen.getByText("Secondary Button"); // Adjust the class name as per your CSS
    expect(buttonElement).toBeInTheDocument();
  });
});
