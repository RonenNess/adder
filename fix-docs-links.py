# create a soup from docs.html
import bs4
soup = bs4.BeautifulSoup(open("docs.html", "r").read(), "html.parser")

# get all anchors
anchors = soup.findAll("a", {"class": "anchor"})

# to generate unique hrefs
href_parts = ["", "", "", "", ""]

# iterate anchors
for anchor in anchors:

    # get first child
    child = None
    for curr_child in anchor.children:
        child = curr_child
        break

    # get key index from child (h1 / h2 / h3.. so we take the number part)
    index = int(child.name[1])-1

    # set to name
    href_parts[index] = child.text.lower().replace(" ", "-")

    # get href
    href = "--".join(href_parts[:index+1])

    # remove some special chars from href
    for invalid in ["(", ")", ",", "[", "]", ".", "&"]:
        href = href.replace(invalid, "")
    
    # now fix anchor href and id
    anchor.attrs['href'] = "#" + href
    anchor.attrs['id'] = href

# write the updated docs file
with open("docs2.html", "w") as output:
    output.write(str(soup))
