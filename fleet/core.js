import {Vector} from "./util.js";

export class Polygon {
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

    get edges() {
        return this.vertices.map((v, i) => [v, this.vertices[(i + 1) % this.vertices.length]]);
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
