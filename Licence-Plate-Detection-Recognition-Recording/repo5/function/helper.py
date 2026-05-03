import math

# license plate type classification helper function
def linear_equation(x1, y1, x2, y2):
    b = y1 - (y2 - y1) * x1 / (x2 - x1)
    a = (y1 - b) / x1
    return a, b

def check_point_linear(x, y, x1, y1, x2, y2):
    a, b = linear_equation(x1, y1, x2, y2)
    y_pred = a*x+b
    return(math.isclose(y_pred, y, abs_tol = 3))

# detect character and number in license plate (YOLOv5 — Plan A)
def read_plate(yolo_license_plate, im):
    LP_type = "1"
    results = yolo_license_plate(im)
    bb_list = results.pandas().xyxy[0].values.tolist()
    if len(bb_list) == 0 or len(bb_list) < 7 or len(bb_list) > 10:
        return "unknown"
    center_list = []
    y_mean = 0
    y_sum = 0
    for bb in bb_list:
        x_c = (bb[0]+bb[2])/2
        y_c = (bb[1]+bb[3])/2
        y_sum += y_c
        center_list.append([x_c,y_c,bb[-1]])

    # find 2 point to draw line
    l_point = center_list[0]
    r_point = center_list[0]
    for cp in center_list:
        if cp[0] < l_point[0]:
            l_point = cp
        if cp[0] > r_point[0]:
            r_point = cp
    for ct in center_list:
        if l_point[0] != r_point[0]:
            if (check_point_linear(ct[0], ct[1], l_point[0], l_point[1], r_point[0], r_point[1]) == False):
                LP_type = "2"

    y_mean = int(int(y_sum) / len(bb_list))

    # 1 line plates and 2 line plates
    line_1 = []
    line_2 = []
    license_plate = ""
    if LP_type == "2":
        for c in center_list:
            if int(c[1]) > y_mean:
                line_2.append(c)
            else:
                line_1.append(c)
        for l1 in sorted(line_1, key = lambda x: x[0]):
            license_plate += str(l1[2])
        license_plate += "-"
        for l2 in sorted(line_2, key = lambda x: x[0]):
            license_plate += str(l2[2])
    else:
        for l in sorted(center_list, key = lambda x: x[0]):
            license_plate += str(l[2])
    return license_plate


def read_plate_v8(yolo_license_plate, im):
    """YOLOv8 version of read_plate (Plan B).

    Uses .boxes.data.tolist() + results.names[class_id] instead of
    the YOLOv5-only .pandas().xyxy[0] API.
    """
    LP_type = "1"
    results = yolo_license_plate(im)
    r = results[0]  # YOLOv8 returns a list; take the first result

    if r.boxes is None or len(r.boxes) == 0:
        return "unknown"

    bb_list = r.boxes.data.tolist()  # [[x1, y1, x2, y2, conf, class_id], ...]
    names = r.names                  # {0: '1', 1: '2', ..., 29: '0'}

    if len(bb_list) < 7 or len(bb_list) > 10:
        return "unknown"

    center_list = []
    y_sum = 0
    for bb in bb_list:
        x_c = (bb[0] + bb[2]) / 2
        y_c = (bb[1] + bb[3]) / 2
        y_sum += y_c
        char = names[int(bb[5])]  # resolve integer class_id → character string
        center_list.append([x_c, y_c, char])

    # find leftmost and rightmost points to determine plate type (1-line vs 2-line)
    l_point = min(center_list, key=lambda c: c[0])
    r_point = max(center_list, key=lambda c: c[0])
    if l_point[0] != r_point[0]:
        for ct in center_list:
            if not check_point_linear(
                ct[0], ct[1],
                l_point[0], l_point[1],
                r_point[0], r_point[1],
            ):
                LP_type = "2"
                break

    y_mean = int(y_sum / len(bb_list))

    license_plate = ""
    if LP_type == "2":
        line_1 = [c for c in center_list if int(c[1]) <= y_mean]
        line_2 = [c for c in center_list if int(c[1]) > y_mean]
        for c in sorted(line_1, key=lambda x: x[0]):
            license_plate += str(c[2])
        license_plate += "-"
        for c in sorted(line_2, key=lambda x: x[0]):
            license_plate += str(c[2])
    else:
        for c in sorted(center_list, key=lambda x: x[0]):
            license_plate += str(c[2])
    return license_plate
