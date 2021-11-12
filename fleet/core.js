export class Entity {
    pos = new DOMPoint();
    rot = 0;
    velocity = new DOMPoint();
    spin = 0;

    mass;
    inertia;
    shape;
    hitbox;
    matrix;

    node;
    annotation;

    constructor(node, shape, mass) {
        this.node = node;
        this.shape = shape;
        this.mass = mass;
        let r = Math.max(
            Vector.abs(Vector.sub(shape.vertices[1], shape.vertices[0])),
            Vector.abs(Vector.sub(shape.vertices[2], shape.vertices[1]))
        ) / 2;
        this.r = r;
        this.inertia = this.mass * r * r / 2;
        //this.#updateHitbox();
        this.update(new DOMPoint(), 0);
    }

    update(position, rotation) {
        this.pos = position;
        this.rot = rotation;
        this.matrix = new DOMMatrix().translateSelf(this.pos.x, this.pos.y)
            .rotateSelf(this.rot * 180 / Math.PI);
        this.hitbox = this.shape.transform(this.matrix);
    }

    /*get pos() {
        return this.#pos;
    }

    set pos(value) {
        this.#pos = value;
        // camera
        //const pos = this.#pos.sub(this.node.parentElement.parentElement.ship.pos);
        //this.node.style.transform = `translate(${pos.x}px, ${pos.y}px) rotate(${this.rot}rad)`;
        // this.node.style.transform = `translate(${this.#pos.x}px, ${this.#pos.y}px) rotate(135deg)`;
        // this.node.style.transform = `translate(${this._pos[0]}px, ${this._pos[1]}px) rotate(135deg)`;
        //this.node.style.transform = `rotate(135deg)`;
        //this.node.style.left = `${this._pos[0]}px`;
        //this.node.style.top = `${this._pos[1]}px`;
    }*/

    getVelocityAt(p) {
        return Vector.add(
            this.velocity, Vector.mul(Vector.getNormal(Vector.sub(p, this.pos)), this.spin)
        );
    }

    applyImpulse(j, p) {
        const dv = Vector.mul(j, 1 / this.mass);
        this.velocity = Vector.add(this.velocity, dv);
        return dv;
    }

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
        const minX = Math.min(...this.vertices.map(v => v.x));
        const minY = Math.min(...this.vertices.map(v => v.y));
        const maxX = Math.max(...this.vertices.map(v => v.x));
        const maxY = Math.max(...this.vertices.map(v => v.y));
        return new DOMRect(minX, minY, maxX - minX, maxY - minY);
    }

    transform(matrix) {
        return new Polygon(this.vertices.map(v => matrix.transformPoint(v)));
    }
}
