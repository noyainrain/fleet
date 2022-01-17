/** TODO. */

/** TODO. */
export class Vector {
    static add(a, b) {
        return new DOMPoint(a.x + b.x, a.y + b.y);
    }

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
