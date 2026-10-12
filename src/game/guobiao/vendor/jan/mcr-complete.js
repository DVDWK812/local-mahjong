export class McrComplete {
    constructor(_yakuList) {
        this._yakuList = _yakuList;
        this._point = this._totalPoint(_yakuList);
    }
    toObject() {
        return { yakuList: this._yakuList };
    }
    get point() {
        return this._point;
    }
    get yakuList() {
        return this._yakuList;
    }
    _totalPoint(yakuList) {
        if (yakuList.length === 0) {
            return 0;
        }
        const yakuPointList = yakuList.map((y) => { return y.point; });
        return yakuPointList.reduce((p, c) => { return p + c; });
    }
}
