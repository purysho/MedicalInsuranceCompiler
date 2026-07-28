import React from "react";

/** Lightweight story shape (no Storybook). Each file exports a Story default. */
export interface Story {
  title: string;
  scenes: { name: string; node: React.ReactNode }[];
}
