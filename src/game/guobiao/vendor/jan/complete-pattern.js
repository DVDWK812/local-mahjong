export class CompletePattern {
    constructor(_mentsuList, _head) {
        this._mentsuList = _mentsuList;
        this._head = _head;
    }
    get chowList() {
        return this._mentsuList.filter((m) => {
            return m.chow;
        });
    }
    get concealedPungCount() {
        return this.pungList.filter((p) => { return p.dark; }).length;
    }
    get darkKongCount() {
        return this.kongList.filter((k) => { return k.dark; }).length;
    }
    get dragonCount() {
        return this.pungList.filter((p) => { return p.head.dragon; }).length;
    }
    get head() {
        return this._head;
    }
    get hasJi() {
        return this._mentsuList.some((m) => { return m.hasJi; }) ||
            this._head.ji;
    }
    get jiAll() {
        return this._mentsuList.every((m) => { return m.hasJi; }) &&
            this._head.ji;
    }
    get knittedChowList() {
        return this._mentsuList.filter((m) => {
            return m.knittedChow;
        });
    }
    get kongCount() {
        return this.kongList.length;
    }
    get kongList() {
        return this._mentsuList.filter((m) => {
            return m.kong;
        });
    }
    get mentsuList() {
        return this._mentsuList;
    }
    get pungList() {
        return this._mentsuList.filter((m) => {
            return m.pung || m.kong;
        });
    }
    get windCount() {
        return this.pungList.filter((p) => { return p.head.wind; }).length;
    }
    get yaoAll() {
        return this._mentsuList.every((m) => { return m.hasYao; }) &&
            this._head.yao;
    }
}
