---
title: The tsfigure language
---

# The tsfigure language

A tsfigure file is a TypeScript program that exports a {@link Figure} object. tsfigure runs the program and converts the exported object to a SVG file.

```ts
import { Figure, disk, rgb } from "figure"

const d = disk().radius(0.5).fill(rgb(1, 0, 0))

const figure = new Figure().background(rgb(1, 1, 1))

figure.add(d)

// tsfigure files must export an object named `figure` of type Figure.
export { figure }
```

<img src="red_disk.ts.svg" width="33%"/>

## Creating shapes

The line
```ts
const d = disk().radius(0.5).fill(rgb(1, 0, 0))
```
creates the red disk. In tsfigure, shapes are created using the "builder pattern": A factory function returns an "uninitialized" shape, and then methods are used to set properties of this shape until it is fully defined.

Here `disk()` returns an uninitialized disk and `radius(0.5)` sets its radius. The center isn't explicitly set so it stays at its default value (the origin). Finally, `fill()` sets the color of the shape. Some other common factory methods include: {@link rect}, {@link line}, {@link polygon}.

Any method that is not setting a geometric property of a shape causes the shape to be "finalized" - its geometry is calculated and cannot be changed anymore. This includes setting the color (`fill()`), transformations (`move()`, `scale()`), deriving other shapes (`border()`, `clip()`), etc.

A property method can be called with no arguments to retrieve the value of a property:
```ts
const d = disk().radius(0.5)
const center = d.center()   // Returns Vec(0,0)
```
This also finalizes the shape.

Not all properties need to be set when creating a shape - only a subset that is enough to uniquely define its geometry. The others will be calculated during shape finalization:
```ts
// Two corners are enough to define a rectangle
const square = rect().top_left(vec(-0.5,-0.5)).bottom_right(vec(0.5,0.5)).fill(rgb(1,0,0))

// The center point, width and height also define a rectangle
const square2 = rect().center(0,0).width(1).height(1).fill(rgb(1,0,0))

square2.bottom_left() // Returns Vec(-0.5,0.5)
```

## Coordinate system

The y coordinate increases from top to bottom: the top edge of the figure is y = -1 and the bottom edge is y = 1. The x coordinate increases from left to right: the left edge is x = -&lt;aspect ratio&gt; and the right edge is x = &lt;aspect ratio&gt;. (0,0) is always the center of the figure.

tsfigure also supports polar coordinates with `polar(distance, angle)`. The angle is measured clockwise and 0 degrees means "to the right". Here is the coordinate system for a figure with an aspect ratio of 1.4:

<img src="coordinate_system.ts.svg" width="50%"/>
