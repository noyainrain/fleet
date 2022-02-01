/** TODO. */

/** TODO. */
export class Vector {
    /**
     * Add two vectors.
     *
     * @param {DOMPoint} a - LHS.
     * @param {DOMPoint} b - RHS.
     */
    static add(a, b) {
        return new DOMPoint(a.x + b.x, a.y + b.y);
    }

    /**
     * Subtract two vectors.
     *
     * @param {DOMPoint} a - LHS.
     * @param {DOMPoint} b - RHS.
     */
    static sub(a, b) {
        return new DOMPoint(a.x - b.x, a.y - b.y);
    }

    static dot(a, b) {
        return a.x * b.x + a.y * b.y;
    }

    /*static cross(a, b) {
            // a2 0 - 0 b2
            // a1 0 - 0 b1
            // a1 b2 - a2 b1
            // b.x  b.y
            // b.y -b.x
            // dot(a, getNormal(b));
            // a.x * b.x + a.y * b.y;
            // a.x * b.y + a.y * -b.x;
            // (a.x * b.y) - (a.y * b.x)
        // return a.y * b.x - a.x * by;
    }*/

    static mul(v, s) {
        return new DOMPoint(v.x * s, v.y * s);
    }

    static abs(v) {
        return Math.sqrt(v.x * v.x + v.y * v.y);
    }

    static norm(v) {
        return Vector.mul(v, 1 / Vector.abs(v));
    }

    static getNormal(v) {
        return new DOMPoint(-v.y, v.x);
    }
}

/**
 * Create the :class:`SVGElement` specified by *tagName*.
 *
 * TODO attributes
 */
export function createSVGElement(tagName, attributes = {}) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tagName);
    for (let [name, value] of Object.entries(attributes)) {
        node.setAttribute(name, value);
    }
    return node;
}

export class Box {
    static contains(box, p) {
        return p.x >= box.x && p.x < box.x + box.width && p.y >= box.y && p.y < box.y + box.height;
    }

    static grow(box, size) {
        return new DOMRect(box.x - size, box.y - size, box.width + 2 * size, box.height + 2 * size);
    }
}

/** Polygon shape. */
export class Polygon {
    /** @member {DOMPoint[]} - Corners of the polygon. */
    vertices;

    static fromRect(x, y, width, height) {
        return new Polygon([
            new DOMPoint(x, y), new DOMPoint(x, y + height), new DOMPoint(x + width, y + height),
            new DOMPoint(x + width, y)
        ]);
    }

    constructor(vertices) {
        this.vertices = vertices;
    }

    /** @member {DOMPoint[][]} - Edges of the polygon. */
    get edges() {
        // return this.vertices.map((v, i) => [v, this.vertices[(i + 1) % this.vertices.length]]);
        return this.vertices.map((_, i) => this.getEdge(i));
    }

    get bounds() {
        const xs = this.vertices.map(v => v.x);
        const ys = this.vertices.map(v => v.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        return new DOMRect(minX, minY, maxX - minX, maxY - minY);
    }

    /**
     * Get an edge by index.
     *
     * @param {number} i - Edge index.
     * @returns {?DOMPoint[]}
     */
    getEdge(i) {
        if (i < 0 || i >= this.vertices.length) {
            return null;
        }
        return [this.vertices[i], this.vertices[(i + 1) % this.vertices.length]];
    }

    transform(matrix) {
        return new Polygon(this.vertices.map(v => matrix.transformPoint(v)));
    }

    contains(p) {
        for (let e of this.edges) {
            const axis = Vector.norm(Vector.getNormal(Vector.sub(e[1], e[0])));
            const bound = Vector.dot(e[0], axis);
            const distance = Vector.dot(p, axis) - bound;
            if (distance >= 0) {
                return false;
            }
        }
        return true;
    }
}

export async function transition(node, name) {
    node.classList.add(name);
    await new Promise(resolve => node.addEventListener("transitionend", resolve, {once: true}));
}

export async function animate(node, name) {
    await transition(node, name);
    node.classList.remove(name);
}

export async function animate2(node, name) {
    node.style.animationName = name;
    await new Promise(resolve => node.addEventListener("animationend", resolve, {once: true}));
    node.style.animationName = "";
}

//const tr = new Roulette(new Map([["a", 5], ["b", 2], ["c", 3]]));
//const counts = new Map();
//for (let i = 0; i < 10000; i++) {
//    const item = tr.spin();
//    counts.set(item, (counts.get(item) ?? 0) + 1);
//}
//console.log("ROULETTE AFTER 10k SPINS", counts);

/** TODO. */
export class Roulette {
    pockets;
    #total;

    constructor(pockets) {
        this.pockets = pockets;
        console.log("POCKETVALS", Array.from(this.pockets.values()));
        this.#total = sum(Array.from(this.pockets.values()));
    }

    spin() {
        const draw = Math.random() * this.#total;
        //console.log("SPIN", draw, this.#total);
        let curP = 0;
        for (let [item, p] of this.pockets.entries()) {
            curP += p;
            if (draw < curP) {
                return item;
            }
        }
    }
}

//const bins = [...new Array(3)].map(() => []);
//const roulette = new Roulette(new Map([[0, 6], [1, 3], [2, 1]]));
//const items = new Array(10000).fill("test");
//distribute(items, bins, {capacity: 5000, draw: () => roulette.spin()});
//console.log("DISTRIBUTED", bins[0], bins[1], bins[2]);

/** TODO. */
export function distribute(items, bins, {capacity = Infinity, draw = null} = {}) {
    if (!draw) {
        draw = () => Math.trunc(Math.random() * bins.length);
    }
    if (capacity * bins.length - sum(bins.map(bin => bin.length)) < items.length) {
        throw new Error("NOT ENOUGH SPACE");
    }
    for (let item of shuffle(items)) {
        while (true) {
            const i = draw();
            if (i < 0 || i >= bins.length) {
                throw new RangeError("!!!");
            }
            // console.log("BIN I", i, bins[i].length);
            if (bins[i].length >= capacity) {
                continue;
            }
            bins[i].push(item);
            break;
        }
        // let k;
        // for (k = 0; k < 10; k++) {
        //if (k === 10) {
        //    throw new Error("ENDLESS LOOP");
        //}
    }
}

/** TODO. */
export function shuffle(array) {
    return array.map(item => [item, Math.random()])
        .sort((a, b) => b[1] - a[1])
        .map(item => item[0]);
}

/** TODO. */
export function sum(array) {
    return array.reduce((previousValue, currentValue) => previousValue + currentValue);
}
