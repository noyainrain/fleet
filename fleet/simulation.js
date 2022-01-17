// TODO license

/** Simple 2D physics simulation. */

import {Vector} from "./util.js";

const HTML = `\
<div class="fleet-world-root fleet-world-gpu">
    <div class="fleet-world-base"></div>
</div>
<!--<svg style="background: purple;"></svg>-->
    <!--g class="fleet-world-base"></g>-->
    <!--<g class="fleet-world-camera">
        <g class="fleet-world-annotations"></g>
    </g>-->
<style>
    fleet-world {
        display: block;
        width: 100%;
        height: 100%;
    }

    fleet-world svg,
    .fleet-world-canvas {
        xshape-rendering: optimizeSpeed;
    }

    .fleet-world-root {
        height: 100%;
        overflow: hidden;
    }

    .fleet-world-base {
        position: relative;
        width: 0;
        height: 0;
    }

    .fleet-world-base > * {
        position: absolute;
        transform-origin: center;
    }

    .fleet-world-root.fleet-world-gpu .fleet-world-base > * {
        will-change: transform;
    }
</style>
`;

// We would have preferred to use SVGs, but hardware acceleration is only partly implemented in
// chrome (translation is fast, but rotation / scaling re-rasters SVGs)

/** Simulated world. */
export class WorldElement extends HTMLElement {
    /** TODO */
    size;
    /** TODO *position* :class:`DOMPoint` in m and *orientation* in rad. */
    camera = {position: new DOMPoint(), orientation: 0};
    frameRate = 0;

    #now = 0;
    bodies;
    #root;
    #baseLayer;
    #cameraG;

    #frames = 0;
    #frameRateSampleTime = 0;

    constructor() {
        super();
        this.size = parseFloat(this.getAttribute("size")) || 128;
        this.innerHTML = HTML;
        // this.#baseLayer = this.querySelector(".fleet-world-base");

        this.#root = this.querySelector(".fleet-world-root");
        this.#baseLayer = this.querySelector(".fleet-world-base");

        //this.querySelector("svg").setAttribute(
        //    "viewBox", `-${this.size / 2}, -${this.size / 2} ${this.size} ${this.size}`
        //);
        //this.#baseLayer = this.querySelector("svg");

        // this.#cameraG = this.querySelector(".fleet-world-camera");
        this.reset();
    }

    connectedCallback() {
        this.#now = performance.now();
        this.#frameRateSampleTime = this.#now;
        requestAnimationFrame(now => this.#onFrame(now));
    }

    get gpu() {
        return this.#root.classList.has("fleet-world-gpu");
    }

    set gpu(value) {
        this.#root.classList.toggle("fleet-world-gpu", value);
    }

    /** TODO. */
    reset() {
        this.bodies = new Set();
        this.#baseLayer.textContent = "";
        this.updateCamera(new DOMPoint(), 0);
    }

    play() {
        // TODO
    }

    pause() {
        // TODO
    }

    /** TODO. */
    #onFrame(now) {
        const t = (now - this.#now) / 1000;
        this.#now = now;

        if (now >= this.#frameRateSampleTime) {
            this.frameRate = this.#frames;
            this.#frames = 0;
            this.#frameRateSampleTime += 1000;
        }
        this.#frames++;

        this.dispatchEvent(new CustomEvent("tick", {detail: {t}}));

        for (let body of this.bodies) {
            // Apply rotational velocity
            const rot = body.orientation + body.spin * t;
            // Apply linear velocity
            const pos = Vector.add(body.position, Vector.mul(body.velocity, t));
            body.update(pos, rot);
        }

        const width = this.offsetWidth;
        const height = this.offsetHeight;
        const scale = Math.random() * 0.1 + 1;
        //this.#cameraG.style.transform =
        //    `rotate(${-this.camera.orientation}rad) translate(${-this.camera.position.x}px, ${-this.camera.position.y}px)`;
        for (let body of this.bodies) {
            //body.node.style.transform =
            //    `translate(${body.position.x}px, ${body.position.y}px) rotate(${body.orientation}rad)`;
            //body.node.style.transform =
            //    `translate(${body.position.x}px, ${body.position.y}px) rotate(${body.orientation}rad) scale(${scale}, ${scale})`;
            //body.node.style.transform =
            //    `translate(${body.position.x + this.size / 2}px, ${body.position.y + this.size / 2}px) scale(${scale}, ${scale})`;
            //body.node.style.transform =
            //    `translate(${body.position.x + this.size / 2}px, ${body.position.y + this.size / 2}px) rotate(${body.orientation}rad)`;

            //body.node.style.transform =
            //    `translate(-50%, -50%) translate(${body.position.x + width / 2}px, ${body.position.y + height / 2}px) rotate(${body.orientation}rad)`;
            body.node.style.transform =
                `translate(-50%, -50%) translate(${body.position.x}px, ${body.position.y}px) rotate(${body.orientation}rad)`;
        }
        this.#baseLayer.style.transform =
            `translate(${width / 2 - this.camera.position.x}px, ${height / 2 - this.camera.position.y}px) rotate(${-this.camera.orientation}rad)`;

        requestAnimationFrame(now => this.#onFrame(now));
    }

    /** TODO. */
    add(...bodies) {
        for (let body of bodies) {
            this.bodies.add(body);
            this.#baseLayer.append(body.node);
        }
    }

    remove(...bodies) {
        for (let body of bodies) {
            body.node.remove();
            this.bodies.delete(body);
        }
    }

    /** TODO. */
    updateCamera(position, orientation) {
        this.camera.position = position;
        this.camera.orientation = orientation;
    }
}

customElements.define("fleet-world", WorldElement);

/** Rigid body in the simulated world. */
export class Body {
    /** Convex hull :class:`Polygon`. May be ``null``. */
    shape;
    /** Mass in kg. */
    mass;
    /** Moment of inertia in kg m². */
    inertia;
    /** Position :class:`DOMPoint` in m. */
    position;
    /** Orientation in rad. */
    orientation;
    /** Velocity :class:`DOMPoint` in m / s. */
    velocity = new DOMPoint();
    /** Angular velocity in rad / s. */
    spin = 0;
    /** Transformation matrix. */
    matrix;
    /**
     * Hit :class:`Polygon` in world coordinates. ``null`` if no :attribute:`shape` is specified.
     */
    hitbox;
    /** :class:`SVGElement` graphic. */
    node;

    constructor(shape, mass, node) {
        this.shape = shape;
        this.mass = mass;
        this.node = node;

        // Derive moment of intertia
        let r = this.shape ? Math.max(
            Vector.abs(Vector.sub(shape.vertices[1], shape.vertices[0])),
            Vector.abs(Vector.sub(shape.vertices[2], shape.vertices[1]))
        ) / 2 : 0;
        this.r = r;
        this.inertia = this.mass * r * r / 2;

        this.update(new DOMPoint(), 0);
    }

    /** TODO. */
    applyImpulse(j, p) {
        const dv = Vector.mul(j, 1 / this.mass);
        this.velocity = Vector.add(this.velocity, dv);
        return dv;
    }

    /** TODO. */
    update(position, orientation) {
        this.position = position;
        this.orientation = orientation;
        this.matrix = new DOMMatrix().translateSelf(this.position.x, this.position.y).
            rotateSelf(this.orientation * 180 / Math.PI);
        this.hitbox = this.shape ? this.shape.transform(this.matrix) : null;
    }

    /*get pos() {
        return this.#pos;
    }

    set pos(value) {
        this.#pos = value;
        // camera
        //const pos = this.#pos.sub(this.node.parentElement.parentElement.ship.position);
        //this.node.style.transform = `translate(${pos.x}px, ${pos.y}px) rotate(${this.orientation}rad)`;
        // this.node.style.transform = `translate(${this.#pos.x}px, ${this.#pos.y}px) rotate(135deg)`;
        // this.node.style.transform = `translate(${this._pos[0]}px, ${this._pos[1]}px) rotate(135deg)`;
        //this.node.style.transform = `rotate(135deg)`;
        //this.node.style.left = `${this._pos[0]}px`;
        //this.node.style.top = `${this._pos[1]}px`;
    }*/

    /** TODO */
    getVelocityAt(p) {
        return Vector.add(
            this.velocity, Vector.mul(Vector.getNormal(Vector.sub(p, this.position)), this.spin)
        );
    }

    /** TODO. */
    collides(other) {
        // https://developer.mozilla.org/en-US/docs/Games/Techniques/2D_collision_detection
        // Separating axis theorem

        const collision = {
            a: null,
            b: null,
            edge: null,
            vertex: null,
            normal: null,
            distance: -Infinity
        };

        for (let [a, b] of [[this, other], [other, this]]) {
            for (let e of a.hitbox.edges) {
                const axis = Vector.norm(Vector.getNormal(Vector.sub(e[1], e[0])));
                const bound = Vector.dot(e[0], axis);

                let minV = null;
                let minDistance = Infinity;
                for (let v of b.hitbox.vertices) {
                    const distance = Vector.dot(v, axis) - bound;
                    if (distance < minDistance) {
                        minV = v;
                        minDistance = distance;
                    }
                }

                if (minDistance >= 0) {
                    return null;
                }
                if (minDistance > collision.distance) {
                    collision.a = a;
                    collision.b = b;
                    collision.edge = e;
                    collision.vertex = minV;
                    collision.normal = axis;
                    collision.distance = minDistance;
                }
            }
        }

        return collision;
    }
}
